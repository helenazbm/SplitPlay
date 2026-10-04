import { AiError } from "../errors/AiError";
import type {
  AiAccountStatus,
  AiCompletion,
  AiProvider,
  AiVisionRequest,
} from "./AiProvider";

const BASE_URL = "https://openrouter.ai/api/v1";

type ChatCompletionResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: string | null };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    cost?: number;
  };
  error?: { code?: number | string; message?: string };
};

type KeyResponse = {
  data?: {
    limit_remaining?: number | null;
    usage?: number;
    usage_daily?: number;
    usage_monthly?: number;
    is_free_tier?: boolean;
    free_model_daily_requests?: { remaining?: number | null };
  };
};

/**
 * OpenRouter: API compatível com OpenAI, uma chave para vários modelos
 * (Gemini, Claude, modelos :free...). O modelo vem do perfil em
 * `ai.config.json` — trocar de modelo não muda código.
 *
 * Toda resposta traz `usage` com tokens e custo real em US$.
 */
export class OpenRouterProvider implements AiProvider {
  readonly name = "openrouter";

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly structuredOutputs: boolean,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async complete(request: AiVisionRequest): Promise<AiCompletion> {
    const body = await this.post<ChatCompletionResponse>(
      "/chat/completions",
      this.buildBody(request),
      request.signal,
    );

    const choice = body.choices?.[0];
    return {
      text: choice?.message?.content ?? "",
      usage: {
        inputTokens: Number(body.usage?.prompt_tokens ?? 0),
        outputTokens: Number(body.usage?.completion_tokens ?? 0),
        providerCostUsd: typeof body.usage?.cost === "number" ? body.usage.cost : null,
      },
      model: body.model ?? this.model,
      requestId: body.id ?? null,
      truncated: choice?.finish_reason === "length",
    };
  }

  async getAccountStatus(): Promise<AiAccountStatus> {
    const { data } = await this.get<KeyResponse>("/key");
    return {
      creditsRemainingUsd: data?.limit_remaining ?? null,
      usageTodayUsd: Number(data?.usage_daily ?? 0),
      usageThisMonthUsd: Number(data?.usage_monthly ?? 0),
      usageTotalUsd: Number(data?.usage ?? 0),
      freeRequestsRemainingToday: data?.free_model_daily_requests?.remaining ?? null,
      isFreeTier: data?.is_free_tier === true,
    };
  }

  private buildBody(request: AiVisionRequest): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      temperature: 0,
      max_tokens: request.maxOutputTokens,
      messages: [
        { role: "system", content: request.systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: request.userPrompt },
            ...request.images.map((image) => ({
              type: "image_url",
              image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
            })),
          ],
        },
      ],
    };

    if (request.jsonSchema && this.structuredOutputs) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: request.jsonSchema.name, strict: true, schema: request.jsonSchema.schema },
      };
      // Só roteia para endpoints que de fato suportam o schema estrito.
      body.provider = { require_parameters: true };
    }

    return body;
  }

  private post<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    });
  }

  private get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchFn(`${BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "X-Title": "SplitPlay",
        },
      });
    } catch (error) {
      if (init.signal?.aborted) {
        throw new AiError("timeout", "O modelo demorou demais para responder.");
      }
      throw new AiError("provider-unavailable", `Falha de rede: ${(error as Error).message}`);
    }

    const raw = await response.text();
    let parsed: T & { error?: { code?: number | string; message?: string } };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw OpenRouterProvider.errorFor(response.status, raw.slice(0, 200));
    }

    // O OpenRouter também pode devolver erro com HTTP 200 e `error` no corpo.
    if (!response.ok || parsed.error) {
      const status = Number(parsed.error?.code) || response.status;
      throw OpenRouterProvider.errorFor(status, parsed.error?.message ?? raw.slice(0, 200));
    }
    return parsed;
  }

  private static errorFor(status: number, detail: string): AiError {
    switch (status) {
      case 401:
      case 403:
        return new AiError("invalid-key", `Chave recusada pelo OpenRouter: ${detail}`);
      case 402:
        return new AiError("no-credits", `Sem créditos no OpenRouter: ${detail}`);
      case 429:
        return new AiError("rate-limited", `Limite de requisições do OpenRouter: ${detail}`);
      case 408:
        return new AiError("timeout", `OpenRouter: tempo esgotado: ${detail}`);
      default:
        return new AiError("provider-unavailable", `OpenRouter respondeu ${status}: ${detail}`);
    }
  }
}
