/**
 * @jest-environment node
 */

import type { AiVisionRequest } from "@/functions/src/ai/providers/AiProvider";
import { OpenRouterProvider } from "@/functions/src/ai/providers/OpenRouterProvider";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function request(overrides: Partial<AiVisionRequest> = {}): AiVisionRequest {
  return {
    systemPrompt: "sys",
    userPrompt: "user",
    images: [{ mimeType: "image/jpeg", base64: "AAAA" }],
    jsonSchema: { name: "cardapio", schema: { type: "object" } },
    maxOutputTokens: 100,
    signal: new AbortController().signal,
    ...overrides,
  };
}

const OK_BODY = {
  id: "gen-1",
  model: "google/gemini-x",
  choices: [{ finish_reason: "stop", message: { content: '{"items":[]}' } }],
  usage: { prompt_tokens: 1700, completion_tokens: 300, cost: 0.00126 },
};

describe("OpenRouterProvider.complete", () => {
  test("envia imagem como data URL, schema estrito e lê uso/custo", async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(200, OK_BODY));
    const provider = new OpenRouterProvider("chave", "google/gemini-x", true, fetchFn);

    const completion = await provider.complete(request());

    const [url, init] = fetchFn.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.headers.Authorization).toBe("Bearer chave");
    expect(body.model).toBe("google/gemini-x");
    expect(body.messages[1].content[1].image_url.url).toBe("data:image/jpeg;base64,AAAA");
    expect(body.response_format.json_schema).toMatchObject({ name: "cardapio", strict: true });
    expect(body.provider).toEqual({ require_parameters: true });

    expect(completion).toEqual({
      text: '{"items":[]}',
      usage: { inputTokens: 1700, outputTokens: 300, providerCostUsd: 0.00126 },
      model: "google/gemini-x",
      requestId: "gen-1",
      truncated: false,
    });
  });

  test("sem structured outputs (modelo :free) não envia response_format", async () => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(200, OK_BODY));
    const provider = new OpenRouterProvider("chave", "x:free", false, fetchFn);

    await provider.complete(request());

    const body = JSON.parse(fetchFn.mock.calls[0][1].body);
    expect(body.response_format).toBeUndefined();
    expect(body.provider).toBeUndefined();
  });

  test("marca resposta cortada pelo limite de tokens", async () => {
    const body = { ...OK_BODY, choices: [{ finish_reason: "length", message: { content: "{" } }] };
    const provider = new OpenRouterProvider("k", "m", false, jest.fn().mockResolvedValue(jsonResponse(200, body)));

    expect((await provider.complete(request())).truncated).toBe(true);
  });

  test.each([
    [401, "invalid-key"],
    [402, "no-credits"],
    [429, "rate-limited"],
    [503, "provider-unavailable"],
  ])("HTTP %i vira AiError %s", async (status, code) => {
    const fetchFn = jest.fn().mockResolvedValue(jsonResponse(status, { error: { message: "x" } }));
    const provider = new OpenRouterProvider("k", "m", false, fetchFn);

    await expect(provider.complete(request())).rejects.toMatchObject({ code });
  });

  test("erro no corpo com HTTP 200 também é tratado", async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { error: { code: 402, message: "sem saldo" } }));
    const provider = new OpenRouterProvider("k", "m", false, fetchFn);

    await expect(provider.complete(request())).rejects.toMatchObject({ code: "no-credits" });
  });

  test("abort vira timeout", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchFn = jest.fn().mockRejectedValue(new Error("aborted"));
    const provider = new OpenRouterProvider("k", "m", false, fetchFn);

    await expect(provider.complete(request({ signal: controller.signal }))).rejects.toMatchObject({
      code: "timeout",
    });
  });
});

describe("OpenRouterProvider.getAccountStatus", () => {
  test("lê créditos e consumo de /key", async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        data: {
          limit_remaining: 9.5,
          usage: 0.5,
          usage_daily: 0.02,
          usage_monthly: 0.3,
          is_free_tier: false,
          free_model_daily_requests: { remaining: 990 },
        },
      }),
    );
    const provider = new OpenRouterProvider("k", "m", false, fetchFn);

    expect(await provider.getAccountStatus()).toEqual({
      creditsRemainingUsd: 9.5,
      usageTodayUsd: 0.02,
      usageThisMonthUsd: 0.3,
      usageTotalUsd: 0.5,
      freeRequestsRemainingToday: 990,
      isFreeTier: false,
    });
    expect(fetchFn.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/key");
  });
});
