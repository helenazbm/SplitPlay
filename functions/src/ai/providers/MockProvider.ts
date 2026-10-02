import type {
  AiAccountStatus,
  AiCompletion,
  AiProvider,
  AiVisionRequest,
} from "./AiProvider";

/** ~Tokens que um modelo de visão cobra por foto de celular redimensionada. */
const TOKENS_PER_IMAGE = 1600;
const PROMPT_TOKENS = 400;

/**
 * Não chama ninguém e não custa nada. Devolve a resposta fixa recebida no
 * construtor, com tokens na ordem de grandeza real — assim relatórios de
 * consumo têm números plausíveis durante o desenvolvimento.
 */
export class MockProvider implements AiProvider {
  readonly name = "mock";
  readonly model = "mock";

  constructor(private readonly responseText: string) {}

  async complete(request: AiVisionRequest): Promise<AiCompletion> {
    return {
      text: this.responseText,
      usage: {
        inputTokens: PROMPT_TOKENS + request.images.length * TOKENS_PER_IMAGE,
        outputTokens: Math.ceil(this.responseText.length / 4),
        providerCostUsd: 0,
      },
      model: this.model,
      requestId: null,
      truncated: false,
    };
  }

  async getAccountStatus(): Promise<AiAccountStatus | null> {
    return null;
  }
}
