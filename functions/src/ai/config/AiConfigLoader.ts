import { AiError } from "../errors/AiError";
import type {
  AiConfigFile,
  AiLimits,
  AiProfile,
  Pricing,
  ResolvedAiConfig,
} from "./AiConfig";
import configFile from "./ai.config.json";

type Env = Record<string, string | undefined>;

/**
 * Lê `ai.config.json` + variáveis de ambiente e decide o perfil ativo.
 *
 * Ordem: `AI_PROFILE` (env) > `activeProfile` (JSON). A chave vem só de
 * `AI_API_KEY` — segredo nunca entra no JSON.
 *
 * No emulador sem chave, cai para o perfil mock: dev local e testes de
 * integração rodam sem conta em lugar nenhum. Em produção não há esse atalho.
 */
export class AiConfigLoader {
  constructor(
    private readonly file: unknown = configFile,
    private readonly env: Env = process.env,
  ) {}

  load(): ResolvedAiConfig {
    const config = AiConfigLoader.validate(this.file);
    const apiKey = (this.env.AI_API_KEY ?? "").trim();
    const envProfile = (this.env.AI_PROFILE ?? "").trim();

    if (envProfile && !config.profiles[envProfile]) {
      throw new AiError("config-invalid", `AI_PROFILE="${envProfile}" não existe em ai.config.json.`);
    }

    let profileName = envProfile || config.activeProfile;
    let reason: ResolvedAiConfig["reason"] = envProfile ? "env" : "config";

    const needsKey = config.profiles[profileName].provider !== "mock";
    if (needsKey && !apiKey && this.env.FUNCTIONS_EMULATOR === "true") {
      const mockProfile = AiConfigLoader.findMockProfile(config);
      if (mockProfile) {
        profileName = mockProfile;
        reason = "emulator-without-key";
      }
    }

    const referencePricing = config.referenceProfile
      ? config.profiles[config.referenceProfile].pricingUsdPerMillion ?? null
      : null;

    return {
      profileName,
      profile: config.profiles[profileName],
      apiKey,
      limits: config.limits,
      referencePricing,
      reason,
    };
  }

  /** Falha cedo se o JSON estiver inconsistente — melhor no boot que no meio de uma leitura. */
  static validate(raw: unknown): AiConfigFile {
    const config = raw as AiConfigFile;
    if (!config || typeof config !== "object" || !config.profiles) {
      throw new AiError("config-invalid", "ai.config.json: `profiles` é obrigatório.");
    }

    Object.entries(config.profiles).forEach(([name, profile]) =>
      AiConfigLoader.validateProfile(name, profile),
    );

    if (!config.profiles[config.activeProfile]) {
      throw new AiError(
        "config-invalid",
        `ai.config.json: activeProfile "${config.activeProfile}" não existe em profiles.`,
      );
    }
    if (config.referenceProfile && !config.profiles[config.referenceProfile]) {
      throw new AiError(
        "config-invalid",
        `ai.config.json: referenceProfile "${config.referenceProfile}" não existe em profiles.`,
      );
    }

    AiConfigLoader.validateLimits(config.limits);
    return config;
  }

  private static validateProfile(name: string, profile: AiProfile): void {
    if (profile.provider !== "mock" && profile.provider !== "openrouter") {
      throw new AiError("config-invalid", `ai.config.json: perfil "${name}" tem provider desconhecido.`);
    }
    if (profile.provider === "mock") {
      return;
    }
    if (typeof profile.model !== "string" || profile.model.length === 0) {
      throw new AiError("config-invalid", `ai.config.json: perfil "${name}" precisa de \`model\`.`);
    }
    if (!AiConfigLoader.isPricing(profile.pricingUsdPerMillion)) {
      throw new AiError(
        "config-invalid",
        `ai.config.json: perfil "${name}" precisa de \`pricingUsdPerMillion\` {input, output}.`,
      );
    }
  }

  private static validateLimits(limits: AiLimits | undefined): void {
    const keys: (keyof AiLimits)[] = [
      "maxImages",
      "maxImageBytes",
      "maxOutputTokens",
      "timeoutMs",
      "maxMenuItems",
    ];
    for (const key of keys) {
      const value = limits?.[key];
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        throw new AiError("config-invalid", `ai.config.json: limits.${key} deve ser um número > 0.`);
      }
    }
  }

  private static isPricing(value: unknown): value is Pricing {
    const pricing = value as Pricing | undefined;
    return (
      typeof pricing?.input === "number" &&
      pricing.input >= 0 &&
      typeof pricing?.output === "number" &&
      pricing.output >= 0
    );
  }

  private static findMockProfile(config: AiConfigFile): string | undefined {
    return Object.keys(config.profiles).find((name) => config.profiles[name].provider === "mock");
  }
}
