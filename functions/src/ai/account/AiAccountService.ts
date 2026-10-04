import { AiConfigLoader } from "../config/AiConfigLoader";
import type { AiAccountStatus, AiProvider } from "../providers/AiProvider";
import { createAiProvider } from "../providers/AiProviderFactory";

/**
 * Saldo e consumo da conta no provedor (créditos restantes, gasto do dia/mês,
 * requisições grátis restantes). Serve para um painel/admin ou um alerta de
 * "créditos acabando". Devolve null no perfil mock.
 */
export class AiAccountService {
  constructor(private readonly provider: AiProvider) {}

  static create(env?: Record<string, string | undefined>): AiAccountService {
    return new AiAccountService(createAiProvider(new AiConfigLoader(undefined, env).load()));
  }

  getStatus(): Promise<AiAccountStatus | null> {
    return this.provider.getAccountStatus();
  }
}
