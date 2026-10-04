import type { AiErrorCode } from "../errors/AiError";

/**
 * Consumo de UMA chamada à IA. É o que responde "quanto custa por leitura",
 * "qual a latência" e "vale passar para o plano pago".
 */
export type UsageReport = {
  /** Funcionalidade que fez a chamada (ex.: "menu-read"). */
  feature: string;
  status: "ok" | "error";
  errorCode: AiErrorCode | null;

  profile: string;
  profileReason: string;
  provider: string;
  model: string;
  requestId: string | null;

  imageCount: number;
  imageBytes: number;

  inputTokens: number;
  outputTokens: number;
  /** Custo real informado pelo provedor (o OpenRouter informa por requisição). */
  providerCostUsd: number | null;
  /** tokens × preço do perfil ativo em `ai.config.json`. */
  estimatedCostUsd: number | null;
  /** tokens × preço do perfil de referência: "quanto custaria no pago". */
  referenceCostUsd: number | null;

  /** Tempo da chamada ao provedor, em ms. */
  latencyMs: number;
  /** Quantos resultados úteis a chamada gerou (ex.: itens do cardápio). */
  resultCount: number | null;
  /** ISO 8601. */
  startedAt: string;
};
