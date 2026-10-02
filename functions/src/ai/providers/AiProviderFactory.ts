import type { ResolvedAiConfig } from "../config/AiConfig";
import { AiError } from "../errors/AiError";
import type { AiProvider } from "./AiProvider";
import { MockProvider } from "./MockProvider";
import { OpenRouterProvider } from "./OpenRouterProvider";

export type AiProviderFactoryOptions = {
  /** Resposta que o MockProvider devolve (cada funcionalidade passa a sua). */
  mockResponse?: string;
};

/** Factory: o único lugar que sabe qual classe corresponde a cada `provider` do JSON. */
export function createAiProvider(
  config: ResolvedAiConfig,
  options: AiProviderFactoryOptions = {},
): AiProvider {
  switch (config.profile.provider) {
    case "mock":
      return new MockProvider(options.mockResponse ?? "{}");

    case "openrouter":
      if (!config.apiKey) {
        throw new AiError(
          "missing-key",
          `Perfil "${config.profileName}" precisa de AI_API_KEY (ver functions/src/ai/README.md).`,
        );
      }
      return new OpenRouterProvider(
        config.apiKey,
        String(config.profile.model),
        config.profile.structuredOutputs === true,
      );
  }
}
