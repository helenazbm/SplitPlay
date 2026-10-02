import type { AiLimits } from "../config/AiConfig";
import { AiError } from "../errors/AiError";
import type { AiImage, AiImageMime } from "../providers/AiProvider";
import { approxImageBytes } from "../usage/UsageTracker";

const ALLOWED_MIME: AiImageMime[] = ["image/jpeg", "image/png", "image/webp"];
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Valida imagens vindas do app ANTES de gastar uma chamada. Aceita `unknown`
 * porque o payload chega do cliente sem garantia de formato.
 */
export function validateImages(
  raw: unknown,
  limits: Pick<AiLimits, "maxImages" | "maxImageBytes">,
): AiImage[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new AiError("invalid-input", "Envie pelo menos uma foto.");
  }
  if (raw.length > limits.maxImages) {
    throw new AiError("invalid-input", `Envie no máximo ${limits.maxImages} fotos por vez.`);
  }

  return raw.map((entry) => {
    const candidate = (entry ?? {}) as { mimeType?: unknown; base64?: unknown };
    const image: AiImage = {
      mimeType: String(candidate.mimeType ?? "") as AiImageMime,
      base64: String(candidate.base64 ?? ""),
    };

    if (!ALLOWED_MIME.includes(image.mimeType)) {
      throw new AiError("invalid-input", "Formato de imagem não suportado (use JPEG, PNG ou WebP).");
    }
    if (!image.base64 || !BASE64.test(image.base64)) {
      throw new AiError("invalid-input", "Imagem inválida.");
    }
    if (approxImageBytes(image) > limits.maxImageBytes) {
      throw new AiError("invalid-input", "Foto grande demais. Reduza a resolução e tente de novo.");
    }
    return image;
  });
}
