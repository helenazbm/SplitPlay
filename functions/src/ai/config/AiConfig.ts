export type AiProviderName = "mock" | "openrouter";

/** US$ por 1M de tokens. */
export type Pricing = {
  input: number;
  output: number;
};

export type AiProfile = {
  provider: AiProviderName;
  /** Id do modelo no provedor (ex.: "google/gemini-3.5-flash-lite"). */
  model?: string;
  /** Pede JSON Schema estrito ao provedor. Modelos :free costumam não suportar. */
  structuredOutputs?: boolean;
  pricingUsdPerMillion?: Pricing;
};

export type AiLimits = {
  maxImages: number;
  maxImageBytes: number;
  maxOutputTokens: number;
  timeoutMs: number;
  maxMenuItems: number;
};

/** Formato de `ai.config.json`. */
export type AiConfigFile = {
  activeProfile: string;
  /** Perfil usado para estimar "quanto custaria no pago" mesmo rodando no grátis. */
  referenceProfile?: string;
  profiles: Record<string, AiProfile>;
  limits: AiLimits;
};

/** Config efetiva depois de aplicar env e regras de fallback. */
export type ResolvedAiConfig = {
  profileName: string;
  profile: AiProfile;
  apiKey: string;
  limits: AiLimits;
  referencePricing: Pricing | null;
  /** Por que este perfil foi escolhido — vai junto do relatório de uso. */
  reason: "config" | "env" | "emulator-without-key";
};
