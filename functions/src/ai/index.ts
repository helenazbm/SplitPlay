/**
 * API pública do client de IA. O backend importa SÓ daqui — o resto do módulo
 * é detalhe de implementação. Contrato e configuração: ./README.md
 */

export { AiAccountService } from "./account/AiAccountService";
export { aiSecrets, AI_API_KEY } from "./config/secrets";
export { AiError, type AiErrorCode } from "./errors/AiError";
export { MenuReaderClient } from "./menu/MenuReaderClient";
export type { MenuItemDraft, MenuReadResult } from "./menu/MenuTypes";
export type { AiAccountStatus, AiImage, AiImageMime } from "./providers/AiProvider";
export type { UsageReport } from "./usage/UsageReport";
export { LoggerUsageSink, type UsageSink } from "./usage/UsageSink";
