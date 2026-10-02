# Client de IA (`functions/src/ai`)

Ponte entre o backend e o provedor de IA ([OpenRouter](https://openrouter.ai)). Hoje serve a **leitura de cardápio por foto**.

O client **não acessa o Firestore** e não sabe o que é mesa ou usuário. Quem pode chamar, onde salvar e o que fazer com o resultado são decisões do backend.

## Como o backend usa

Importe só de `./ai` (o `index.ts`). O resto do módulo é detalhe de implementação.

```ts
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { AiError, MenuReaderClient, aiSecrets } from "./ai";

export const parseMenu = onCall({ secrets: aiSecrets(), timeoutSeconds: 120 }, async (request) => {
  // ...auth, checar se é admin, limites diários (responsabilidade do back)

  const reader = MenuReaderClient.create({ usageSink: minhaGravacaoDeConsumo });
  try {
    const { menuName, items, discarded, usage } = await reader.readMenu(request.data.images);
    // ...salvar cardápio
  } catch (error) {
    if (error instanceof AiError) {
      // error.code → mensagem para o usuário; error.usage → consumo da tentativa
    }
    throw error;
  }
});
```

### Contrato

| | |
|---|---|
| **Entrada** | `images: { mimeType: "image/jpeg" \| "image/png" \| "image/webp", base64: string }[]` (de 1 a `limits.maxImages`). O base64 vai sem o prefixo `data:` |
| **Saída** | `{ menuName, items: { section, name, price }[], discarded, usage }`. `price` é o preço unitário em reais. A lista pode vir vazia (foto sem itens legíveis): o back decide o que fazer |
| **Erros** | Sempre `AiError` com um destes `code`: `invalid-input`, `missing-key`, `invalid-key`, `no-credits`, `rate-limited`, `timeout`, `bad-response`, `provider-unavailable` ou `config-invalid` |
| **Consumo** | Toda chamada ao provedor (com sucesso ou erro) gera um `UsageReport`, entregue ao `UsageSink` e devolvido em `result.usage` ou `error.usage` |

Para o banckend: redimensionar a foto para no máximo **1568 px** no lado maior, em JPEG com qualidade ~0,8, antes de enviar. Imagem maior não aumentaria a leitura, só aumenta upload e tokens.

### Registro de consumo (`UsageSink`)

Por padrão, o consumo vai só para o log das Functions (`LoggerUsageSink`). Para guardar, o back implementa a interface:

```ts
const minhaGravacaoDeConsumo: UsageSink = {
  record: (report) => db.collection("aiUsage").add(report).then(() => undefined),
};
```

Cada `UsageReport` traz: tokens de entrada e saída, `latencyMs`, `providerCostUsd` (custo real informado pelo OpenRouter), `estimatedCostUsd` (tokens × preço do config), `referenceCostUsd` ("quanto custaria no pago"), perfil, modelo, número de imagens e bytes, status e erro.

### Saldo de créditos

```ts
const status = await AiAccountService.create().getStatus();
// { creditsRemainingUsd, usageTodayUsd, usageThisMonthUsd, usageTotalUsd, freeRequestsRemainingToday, isFreeTier }
```

## Configuração: só falta a chave

| Onde | O quê | Versionado? |
|---|---|---|
| `config/ai.config.json` | Perfis (`mock`, `free`, `paid`), modelo, preço por 1M de tokens e limites | Sim |
| `AI_PROFILE` (env) | Sobrescreve `activeProfile` sem editar o JSON | Não |
| `AI_API_KEY` (segredo) | Chave do OpenRouter, a mesma para os perfis `free` e `paid` | **Nunca** |

### Grátis × pago

| Perfil | Chave | Custo | Limites |
|---|---|---|---|
| `mock` | Não precisa | Zero | Nenhum. Devolve um cardápio de exemplo |
| `free` | Do OpenRouter, sem créditos | Zero | Modelos `:free`: 20 req/min e 50 req/dia (1000/dia se a conta já comprou ≥ US$ 10 em créditos). O provedor pode usar os dados para treino |
| `paid` | Do OpenRouter, com créditos | ~US$ 0,001–0,005 por foto com `gemini-3.5-flash-lite` | Os créditos pré-pagos. Defina um limite de gasto na chave, no painel do OpenRouter |

Para trocar o modelo, edite `model` e `pricingUsdPerMillion` no JSON (os preços estão em openrouter.ai/models). Nenhum código muda.

### Passo a passo

1. Crie uma chave em openrouter.ai/keys. Para o modo pago, compre créditos e defina um limite na chave.
2. **Local (emulador):** crie `functions/.env.local`, que não é versionado:
   ```
   AI_API_KEY=sk-or-...
   AI_PROFILE=free
   ```
   Sem esse arquivo, o emulador usa o `mock` automaticamente. Os testes de integração e o desenvolvimento local rodam sem chave e sem custo.
3. **Produção:**
   ```
   firebase functions:secrets:set AI_API_KEY
   ```
   O perfil ativo é o `activeProfile` do JSON ou `AI_PROFILE` em `functions/.env`. Em produção não existe fallback para o mock: sem chave, a leitura falha com `missing-key`.

## Estrutura

```
ai/
├── index.ts                    API pública (o back importa só daqui)
├── config/                     ai.config.json + AiConfigLoader (JSON + env) + segredo
├── providers/                  AiProvider (Strategy) · OpenRouterProvider · MockProvider · factory
├── usage/                      UsageReport · UsageTracker (tokens/latência/custo) · UsageSink
├── images/                     validação das imagens recebidas
├── menu/                       MenuReaderClient (Facade) · prompt/schema · parser da resposta
├── account/                    AiAccountService (saldo de créditos)
└── errors/                     AiError (códigos que o back trata)
```

Para outra funcionalidade com IA, crie uma pasta ao lado de `menu/` com sua própria fachada. Config, provedores e medição de consumo são reaproveitados.

Testes: `npx jest tests/ai`.
