import type { Pricing, ResolvedAiConfig } from "../config/AiConfig";
import { AiError, type AiErrorCode } from "../errors/AiError";
import type { AiCompletion, AiImage, AiProvider } from "../providers/AiProvider";
import type { UsageReport } from "./UsageReport";

export function estimateCostUsd(
  tokens: { inputTokens: number; outputTokens: number },
  pricing: Pricing | null | undefined,
): number | null {
  if (!pricing) {
    return null;
  }
  const cost =
    (tokens.inputTokens * pricing.input + tokens.outputTokens * pricing.output) / 1_000_000;
  // 6 casas: uma chamada custa frações de centavo de dólar.
  return Math.round(cost * 1_000_000) / 1_000_000;
}

export function approxImageBytes(image: AiImage): number {
  return Math.floor((image.base64.length * 3) / 4);
}

/**
 * Mede uma chamada ao provedor: latência, tokens e custo (real e estimado).
 * Erros saem como `AiError` já com o relatório anexado — chamada que falha
 * também pode ter consumido tokens.
 */
export class UsageTracker {
  constructor(
    private readonly config: ResolvedAiConfig,
    private readonly provider: AiProvider,
    private readonly feature: string,
    private readonly now: () => number = Date.now,
  ) {}

  async measure(
    images: AiImage[],
    call: () => Promise<AiCompletion>,
  ): Promise<{ completion: AiCompletion; report: UsageReport }> {
    const startedAt = this.now();
    const base = this.baseReport(images, startedAt);

    try {
      const completion = await call();
      const report: UsageReport = {
        ...base,
        ...this.costsFor(completion.usage),
        model: completion.model,
        requestId: completion.requestId,
        latencyMs: this.now() - startedAt,
      };
      return { completion, report };
    } catch (error) {
      const aiError =
        error instanceof AiError
          ? error
          : new AiError("provider-unavailable", (error as Error).message);
      throw aiError.withUsage(
        UsageTracker.failed({ ...base, latencyMs: this.now() - startedAt }, aiError.code),
      );
    }
  }

  /** Marca como falha uma chamada que respondeu mas cujo conteúdo não serviu. */
  static failed(report: UsageReport, code: AiErrorCode): UsageReport {
    return { ...report, status: "error", errorCode: code };
  }

  private costsFor(usage: AiCompletion["usage"]) {
    return {
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      providerCostUsd: usage.providerCostUsd,
      estimatedCostUsd: estimateCostUsd(usage, this.config.profile.pricingUsdPerMillion),
      referenceCostUsd: estimateCostUsd(usage, this.config.referencePricing),
    };
  }

  private baseReport(images: AiImage[], startedAt: number): UsageReport {
    return {
      feature: this.feature,
      status: "ok",
      errorCode: null,
      profile: this.config.profileName,
      profileReason: this.config.reason,
      provider: this.provider.name,
      model: this.provider.model,
      requestId: null,
      imageCount: images.length,
      imageBytes: images.reduce((sum, image) => sum + approxImageBytes(image), 0),
      inputTokens: 0,
      outputTokens: 0,
      providerCostUsd: null,
      estimatedCostUsd: null,
      referenceCostUsd: null,
      latencyMs: 0,
      resultCount: null,
      startedAt: new Date(startedAt).toISOString(),
    };
  }
}
