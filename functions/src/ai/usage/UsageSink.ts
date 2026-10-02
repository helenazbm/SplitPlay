import { logger } from "firebase-functions/v2";

import type { UsageReport } from "./UsageReport";

/**
 * Destino dos relatórios de consumo. O client não decide onde salvar — quem
 * usa o client (o backend) passa a implementação, por exemplo gravando em
 * uma coleção do Firestore.
 */
export interface UsageSink {
  record(report: UsageReport): Promise<void>;
}

/** Padrão: só registra no log das Functions (Cloud Logging). */
export class LoggerUsageSink implements UsageSink {
  async record(report: UsageReport): Promise<void> {
    logger.info("Consumo de IA", report);
  }
}
