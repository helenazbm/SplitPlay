/**
 * @jest-environment node
 */

import type { AiConfigFile } from "@/functions/src/ai/config/AiConfig";
import { AiConfigLoader } from "@/functions/src/ai/config/AiConfigLoader";
import { AiError } from "@/functions/src/ai/errors/AiError";
import { createAiProvider } from "@/functions/src/ai/providers/AiProviderFactory";

function configFile(): AiConfigFile {
  return {
    activeProfile: "free",
    referenceProfile: "paid",
    profiles: {
      mock: { provider: "mock" },
      free: { provider: "openrouter", model: "x/free:free", pricingUsdPerMillion: { input: 0, output: 0 } },
      paid: {
        provider: "openrouter",
        model: "x/paid",
        structuredOutputs: true,
        pricingUsdPerMillion: { input: 0.3, output: 2.5 },
      },
    },
    limits: {
      maxImages: 3,
      maxImageBytes: 4_000_000,
      maxOutputTokens: 8000,
      timeoutMs: 60000,
      maxMenuItems: 300,
    },
  };
}

describe("AiConfigLoader", () => {
  test("o ai.config.json versionado é válido", () => {
    const config = new AiConfigLoader(undefined, { AI_API_KEY: "k" }).load();
    expect(config.profile).toBeDefined();
  });

  test("usa activeProfile do JSON por padrão", () => {
    const config = new AiConfigLoader(configFile(), { AI_API_KEY: "k" }).load();
    expect(config.profileName).toBe("free");
    expect(config.reason).toBe("config");
    expect(config.referencePricing).toEqual({ input: 0.3, output: 2.5 });
  });

  test("AI_PROFILE sobrescreve o JSON", () => {
    const config = new AiConfigLoader(configFile(), { AI_PROFILE: "paid", AI_API_KEY: "k" }).load();
    expect(config.profileName).toBe("paid");
    expect(config.reason).toBe("env");
  });

  test("AI_PROFILE inexistente é erro de config", () => {
    expect(() => new AiConfigLoader(configFile(), { AI_PROFILE: "x" }).load()).toThrow(AiError);
  });

  test("emulador sem chave usa o mock", () => {
    const config = new AiConfigLoader(configFile(), { FUNCTIONS_EMULATOR: "true" }).load();
    expect(config.profileName).toBe("mock");
    expect(config.reason).toBe("emulator-without-key");
  });

  test("produção sem chave não cai para o mock: a factory recusa", () => {
    const config = new AiConfigLoader(configFile(), {}).load();
    expect(config.profileName).toBe("free");
    expect(() => createAiProvider(config)).toThrow(
      expect.objectContaining({ code: "missing-key" }),
    );
  });

  test.each([
    ["activeProfile inexistente", (c: AiConfigFile) => (c.activeProfile = "nada")],
    ["perfil pago sem preço", (c: AiConfigFile) => delete c.profiles.paid.pricingUsdPerMillion],
    ["perfil pago sem modelo", (c: AiConfigFile) => delete c.profiles.paid.model],
    ["limite zerado", (c: AiConfigFile) => (c.limits.timeoutMs = 0)],
  ])("rejeita %s", (_label, mutate) => {
    const file = configFile();
    mutate(file);
    expect(() => AiConfigLoader.validate(file)).toThrow(
      expect.objectContaining({ code: "config-invalid" }),
    );
  });
});
