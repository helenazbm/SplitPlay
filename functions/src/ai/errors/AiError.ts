import type { UsageReport } from "../usage/UsageReport";

/**
 * Motivos de falha que o backend precisa distinguir para responder ao usuário
 * (ex.: "sem créditos" ≠ "foto ilegível"). Nenhum código de provedor vaza
 * para fora do módulo — só estes.
 */
export type AiErrorCode =
  | "config-invalid"
  | "missing-key"
  | "invalid-key"
  | "no-credits"
  | "rate-limited"
  | "timeout"
  | "invalid-input"
  | "bad-response"
  | "provider-unavailable";

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string,
    /** Consumo da chamada que falhou, quando houve chamada (tokens podem ter sido cobrados). */
    readonly usage: UsageReport | null = null,
  ) {
    super(message);
    this.name = "AiError";
  }

  withUsage(usage: UsageReport): AiError {
    return new AiError(this.code, this.message, usage);
  }
}
