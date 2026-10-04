/**
 * Contrato de um provedor de IA (Strategy). Genérico de propósito: recebe
 * imagens + prompt e devolve texto + tokens. Não sabe nada de cardápio — o que
 * é específico de cada funcionalidade fica em `ai/menu/`.
 */

export type AiImageMime = "image/jpeg" | "image/png" | "image/webp";

export type AiImage = {
  mimeType: AiImageMime;
  /** Base64 puro, sem o prefixo `data:...;base64,`. */
  base64: string;
};

export type AiJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
};

export type AiVisionRequest = {
  systemPrompt: string;
  userPrompt: string;
  images: AiImage[];
  /** Pede resposta no formato do schema (quando o perfil suporta structured outputs). */
  jsonSchema?: AiJsonSchema;
  maxOutputTokens: number;
  signal: AbortSignal;
};

export type AiTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  /** Custo informado pelo próprio provedor (US$). null quando ele não informa. */
  providerCostUsd: number | null;
};

export type AiCompletion = {
  text: string;
  usage: AiTokenUsage;
  /** Modelo que de fato respondeu (o provedor pode rotear para uma variante). */
  model: string;
  requestId: string | null;
  /** Resposta cortada pelo limite de tokens de saída. */
  truncated: boolean;
};

/** Saldo e consumo da conta no provedor — para acompanhar créditos. */
export type AiAccountStatus = {
  /** Créditos restantes em US$ (null = sem limite definido na chave). */
  creditsRemainingUsd: number | null;
  usageTodayUsd: number;
  usageThisMonthUsd: number;
  usageTotalUsd: number;
  /** Requisições restantes hoje em modelos gratuitos (null = desconhecido). */
  freeRequestsRemainingToday: number | null;
  /** true enquanto a conta nunca comprou créditos. */
  isFreeTier: boolean;
};

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  complete(request: AiVisionRequest): Promise<AiCompletion>;
  getAccountStatus(): Promise<AiAccountStatus | null>;
}
