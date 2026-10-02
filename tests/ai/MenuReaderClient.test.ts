/**
 * @jest-environment node
 */

import type { ResolvedAiConfig } from "@/functions/src/ai/config/AiConfig";
import { AiError } from "@/functions/src/ai/errors/AiError";
import { MenuReaderClient } from "@/functions/src/ai/menu/MenuReaderClient";
import type { AiCompletion, AiProvider } from "@/functions/src/ai/providers/AiProvider";
import type { UsageReport } from "@/functions/src/ai/usage/UsageReport";
import type { UsageSink } from "@/functions/src/ai/usage/UsageSink";
import { estimateCostUsd } from "@/functions/src/ai/usage/UsageTracker";

const IMAGES = [{ mimeType: "image/jpeg", base64: "AAAA" }];

const CONFIG: ResolvedAiConfig = {
  profileName: "free",
  profile: {
    provider: "openrouter",
    model: "x:free",
    pricingUsdPerMillion: { input: 0, output: 0 },
  },
  apiKey: "k",
  limits: { maxImages: 3, maxImageBytes: 1000, maxOutputTokens: 100, timeoutMs: 1000, maxMenuItems: 10 },
  referencePricing: { input: 0.3, output: 2.5 },
  reason: "config",
};

class MemorySink implements UsageSink {
  reports: UsageReport[] = [];
  async record(report: UsageReport) {
    this.reports.push(report);
  }
}

function fakeProvider(result: Partial<AiCompletion> | Error): AiProvider {
  return {
    name: "fake",
    model: "x:free",
    getAccountStatus: async () => null,
    complete: async () => {
      if (result instanceof Error) {
        throw result;
      }
      return {
        text: '{"menuName":null,"items":[{"section":null,"name":"Água","price":5}]}',
        usage: { inputTokens: 2000, outputTokens: 1500, providerCostUsd: 0 },
        model: "x:free",
        requestId: "gen-1",
        truncated: false,
        ...result,
      };
    },
  };
}

function client(provider: AiProvider, sink: UsageSink) {
  return new MenuReaderClient({ config: CONFIG, provider, usageSink: sink });
}

describe("MenuReaderClient.readMenu", () => {
  test("devolve itens + relatório de consumo e grava no sink", async () => {
    const sink = new MemorySink();

    const result = await client(fakeProvider({}), sink).readMenu(IMAGES);

    expect(result.items).toEqual([{ section: null, name: "Água", price: 5 }]);
    expect(result.usage).toMatchObject({
      feature: "menu-read",
      status: "ok",
      profile: "free",
      inputTokens: 2000,
      outputTokens: 1500,
      providerCostUsd: 0,
      estimatedCostUsd: 0,
      // "quanto custaria no pago": 2000×0,30 + 1500×2,50 por 1M
      referenceCostUsd: 0.00435,
      imageCount: 1,
      resultCount: 1,
      requestId: "gen-1",
    });
    expect(sink.reports).toEqual([result.usage]);
  });

  test("imagem inválida falha antes de chamar o provedor (sem consumo)", async () => {
    const sink = new MemorySink();
    const provider = fakeProvider({});
    const spy = jest.spyOn(provider, "complete");

    await expect(client(provider, sink).readMenu([{ mimeType: "image/gif", base64: "AA" }]))
      .rejects.toMatchObject({ code: "invalid-input" });
    expect(spy).not.toHaveBeenCalled();
    expect(sink.reports).toEqual([]);
  });

  test("erro do provedor sai como AiError com consumo anexado e registrado", async () => {
    const sink = new MemorySink();
    const error = await client(fakeProvider(new AiError("no-credits", "sem saldo")), sink)
      .readMenu(IMAGES)
      .catch((e) => e);

    expect(error).toBeInstanceOf(AiError);
    expect(error.code).toBe("no-credits");
    expect(error.usage).toMatchObject({ status: "error", errorCode: "no-credits" });
    expect(sink.reports).toHaveLength(1);
  });

  test("resposta ilegível registra os tokens gastos como erro", async () => {
    const sink = new MemorySink();
    const error = await client(fakeProvider({ text: "desculpe" }), sink)
      .readMenu(IMAGES)
      .catch((e) => e);

    expect(error.code).toBe("bad-response");
    expect(sink.reports[0]).toMatchObject({ status: "error", inputTokens: 2000 });
  });

  test("resposta cortada pelo limite de tokens é bad-response", async () => {
    const sink = new MemorySink();
    await expect(client(fakeProvider({ truncated: true }), sink).readMenu(IMAGES))
      .rejects.toMatchObject({ code: "bad-response" });
  });

  test("falha ao gravar consumo não derruba a leitura", async () => {
    const brokenSink: UsageSink = { record: async () => Promise.reject(new Error("db fora")) };

    const result = await client(fakeProvider({}), brokenSink).readMenu(IMAGES);
    expect(result.items).toHaveLength(1);
  });

  test("create() no emulador sem chave usa o mock", async () => {
    const reader = MenuReaderClient.create({
      usageSink: new MemorySink(),
      env: { FUNCTIONS_EMULATOR: "true" },
    });

    const result = await reader.readMenu(IMAGES);
    expect(reader.profileName).toBe("mock");
    expect(result.items.length).toBeGreaterThan(0);
  });
});

test("estimateCostUsd: tokens × preço por 1M", () => {
  expect(estimateCostUsd({ inputTokens: 2000, outputTokens: 1500 }, { input: 0.3, output: 2.5 }))
    .toBeCloseTo(0.00435, 6);
  expect(estimateCostUsd({ inputTokens: 1, outputTokens: 1 }, null)).toBeNull();
});
