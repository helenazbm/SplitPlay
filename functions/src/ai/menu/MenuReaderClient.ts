import { logger } from "firebase-functions/v2";

import type { ResolvedAiConfig } from "../config/AiConfig";
import { AiConfigLoader } from "../config/AiConfigLoader";
import { AiError } from "../errors/AiError";
import { validateImages } from "../images/validateImages";
import type { AiProvider } from "../providers/AiProvider";
import { createAiProvider } from "../providers/AiProviderFactory";
import type { UsageReport } from "../usage/UsageReport";
import { LoggerUsageSink, type UsageSink } from "../usage/UsageSink";
import { UsageTracker } from "../usage/UsageTracker";
import { MENU_MOCK_RESPONSE } from "./menuMock";
import { MENU_JSON_SCHEMA, MENU_SYSTEM_PROMPT, MENU_USER_PROMPT } from "./menuPrompt";
import { MenuResponseParser } from "./MenuResponseParser";
import type { MenuReadResult } from "./MenuTypes";

const FEATURE = "menu-read";

export type MenuReaderDependencies = {
  config: ResolvedAiConfig;
  provider: AiProvider;
  usageSink: UsageSink;
};

/**
 * Fachada (Facade) da leitura de cardápio — o ÚNICO ponto que o backend usa:
 *
 *   const reader = MenuReaderClient.create({ usageSink: minhaGravacao });
 *   const { items, usage } = await reader.readMenu(request.data.images);
 *
 * Esconde config, escolha de provedor, prompt, validação da resposta e medição
 * de consumo. Não acessa Firestore nem sabe de mesa/usuário: quem pode chamar
 * e onde salvar são decisões do backend.
 *
 * Erros: sempre `AiError` (ver `code`), com `usage` preenchido quando houve
 * chamada ao provedor.
 */
export class MenuReaderClient {
  private readonly parser: MenuResponseParser;

  constructor(private readonly deps: MenuReaderDependencies) {
    this.parser = new MenuResponseParser(deps.config.limits.maxMenuItems);
  }

  /** Composition root: monta as dependências a partir de `ai.config.json` + env. */
  static create(options: { usageSink?: UsageSink; env?: Record<string, string | undefined> } = {}) {
    const config = new AiConfigLoader(undefined, options.env).load();
    return new MenuReaderClient({
      config,
      provider: createAiProvider(config, { mockResponse: MENU_MOCK_RESPONSE }),
      usageSink: options.usageSink ?? new LoggerUsageSink(),
    });
  }

  /** Perfil ativo (mock/free/paid) — útil para o backend logar ou exibir. */
  get profileName(): string {
    return this.deps.config.profileName;
  }

  async readMenu(rawImages: unknown): Promise<MenuReadResult> {
    const { config, provider } = this.deps;
    const images = validateImages(rawImages, config.limits);
    const tracker = new UsageTracker(config, provider, FEATURE);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.limits.timeoutMs);

    let report: UsageReport | null = null;
    try {
      const measured = await tracker.measure(images, () =>
        provider.complete({
          systemPrompt: MENU_SYSTEM_PROMPT,
          userPrompt: MENU_USER_PROMPT,
          images,
          jsonSchema: MENU_JSON_SCHEMA,
          maxOutputTokens: config.limits.maxOutputTokens,
          signal: controller.signal,
        }),
      );
      report = measured.report;

      if (measured.completion.truncated) {
        throw new AiError("bad-response", "Resposta cortada pelo limite de tokens de saída.");
      }

      const parsed = this.parser.parse(measured.completion.text);
      report = { ...report, resultCount: parsed.items.length };
      return { ...parsed, usage: report };
    } catch (error) {
      const aiError = MenuReaderClient.toAiError(error);
      report = aiError.usage ?? (report ? UsageTracker.failed(report, aiError.code) : null);
      throw report ? aiError.withUsage(report) : aiError;
    } finally {
      clearTimeout(timer);
      if (report) {
        await this.recordSafely(report);
      }
    }
  }

  /** Falha ao gravar consumo não pode derrubar uma leitura que deu certo. */
  private async recordSafely(report: UsageReport): Promise<void> {
    try {
      await this.deps.usageSink.record(report);
    } catch (error) {
      logger.error("Falha ao registrar consumo de IA", { error: (error as Error).message });
    }
  }

  private static toAiError(error: unknown): AiError {
    if (error instanceof AiError) {
      return error;
    }
    return new AiError("provider-unavailable", (error as Error)?.message ?? "Erro desconhecido.");
  }
}
