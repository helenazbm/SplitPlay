**# Fluxos do Sistema — Split Play**

- --

**## 1. Atores**

| Ator | Descrição |

|---|---|

| ****Visitante**** | Não logado, fora de qualquer mesa. Pode acessar landing, fazer cadastro/login, ou abrir um link de mesa. |

| ****Anônimo**** | Entrou em uma mesa via link/QR sem criar conta. Tem nome + avatar pré-definido. Existência do UID é temporária mas persistida pelo Firebase Auth (anônimo). |

| ****Cadastrado**** | Conta no Firebase Auth (e-mail, Google, etc.). Tem moedas, avatar customizável, histórico. |

| ****Adm da mesa**** | Sub-papel: criador da mesa, OU quem recebeu a função delegada. ****Apenas Cadastrados**** podem ser adm. |

- --

**## 2. Estados**

**### Usuário**

- `visitante` → `anônimo` (entrou em mesa) → `cadastrado` (criou conta)
- Cadastrado pode estar `dentro_de_mesa` (campo `currentTableId`) ou `fora_de_mesa`

### Mesa

- `aberta` — recebe novos participantes, itens e pagamentos
- `encerrada` — bloqueada para qualquer operação

(Sem estados intermediários.)

### Item da mesa

- `aguardando_aceite` — apenas para itens compartilhados aguardando resposta. Status visível **só para o owner** do item.
- `confirmado` — item individual (nasce assim) ou compartilhado já decidido. Aparece no perfil de cada participante da divisão.
- `pago` — entra nesse estado quando o owner/participante marca a conta como paga.
- --

## 2.4 Visibilidade / privacidade

Cada participante vê **só os próprios itens** no seu perfil. Ninguém (nem adm) vê o detalhe do consumo de outros.

| Informação | Quem vê |

|---|---|

| Total geral da mesa | Todos os participantes |

| Lista de participantes (nome + avatar) | Todos |

| Quantos pagaram (ex: "3 de 5 pagaram") | Todos |

| Itens consumidos por **outro** participante | Ninguém |

| Itens próprios | Só o participante (no próprio perfil) |

| Item compartilhado já confirmado | Owner + todos que aceitaram a divisão |

| Status `aguardando_aceite` de um item compartilhado | Só o owner |

> **Implicação técnica:** as security rules do Firestore precisam impedir que um participante leia itens de outros. A query "todos os itens da mesa" não pode ser permitida — cada cliente lê **só os documentos onde aparece como owner ou divisor aceito**.

- --

## 2.5 Modelo de divisão e pagamento (snapshot)

Itens compartilhados podem ser modificados (adicionar/remover divisor) **mesmo depois que outros participantes já pagaram**. O modelo abaixo evita travas globais e mantém todo cálculo local e atômico.

### Estado de cada item compartilhado

| Campo | Descrição |

|---|---|

| `valorTotalOriginal` | Valor cobrado pelo item (não muda) |

| `valorRestante` | Valor que ainda não foi pago (diminui conforme divisores pagam) |

| `divisores` | Lista de UIDs ainda **não pagos** que dividem o item |

A cota individual a cada momento é `valorRestante / divisores.length`.

### Pagamento (snapshot)

Quando A clica em "pagar conta":

1. Calcula a cota atual de A em cada item compartilhado em que aparece

2. Para cada um desses itens:

- `valorRestante -= cota_de_A`

- Remove A de `divisores`

3. Marca `participants/{A}.paid = true`

A **não é mais afetado** por mudanças posteriores. Outros divisores continuam dinâmicos.

### Adicionar divisor a um item existente

Recalcula `valorRestante / (divisores.length + 1)`.

- **Beneficia** os divisores que ainda não pagaram (cota cai)
- **Quem já pagou não recebe devolução** — pagamento é final

### Remover divisor de um item existente

Recalcula `valorRestante / (divisores.length - 1)`.

- **Onera** os divisores restantes (cota sobe)
- **Quem já pagou não recebe ajuste** — pagamento é final

### Cancelar item compartilhado já parcialmente pago

Item é deletado, `valorRestante` vira 0, some pros não-pagos. **O dinheiro já pago não volta**. UI deve avisar antes de deletar.

### Implicações

- Quem paga **primeiro** assume o risco da configuração da mesa não estar 100% fechada (futuras mudanças de divisores não o beneficiam)
- Quem paga **por último** absorve qualquer impacto de mudanças posteriores
- Sem locks globais — cada mudança é uma transação Firestore atômica
- Audit trail natural: `valorTotalOriginal - valorRestante` no encerramento da mesa mostra quanto já foi pago daquele item
- --

## 3. Fluxos principais

### 3.1 Cadastro de novo usuário

1. Visitante clica em **Criar conta**

2. Escolhe método de auth: **e-mail/senha** ou **Google**

3. Firebase Auth cria UID

4. Sistema cria documento em `users/{uid}` com:

- `displayName` (nome digitado ou vindo do provedor)

- `coins = 10` (bônus de cadastro)

- `avatar` = preset escolhido (feminino ou masculino)

- `ownedItemIds` = 3 peças default equipadas

- `currentTableId = null`

5. Redireciona pra home

- *Cenários adicionais:**
- Login (usuário já existente)
- Logout
- Esqueci a senha
- **Sem verificação de e-mail** — usuário entra no app imediatamente após cadastro (evita atrito)
- Editar perfil (nome, trocar avatar)
- **Excluir conta** — disponível nas configurações; remove `users/{uid}` e revoga o auth
- --

### 3.2 Criar mesa (Cadastrado)

1. Cadastrado na home clica em **Criar mesa**

2. Preenche formulário:

- Nome da mesa (obrigatório)

- Toggle "10% do garçom" (sugestão; informativo)

- Couvert: valor sugerido (opcional; informativo)

3. Sistema:

- Gera `tableId` único

- Cria `tables/{tableId}` com:

- `adminUid = uid` do criador

- `name`, `tipSuggested` (true/false), `couvertSuggested` (valor)

- `status = 'aberta'`

- Adiciona criador em `participants/{uid}`

- Gera URL compartilhável e dados pra QR code

4. Redireciona para a tela da mesa

> **Comportamento dos metadados sugeridos:** ao entrar na mesa, o sistema **auto-adiciona o couvert** como item individual deletável (se `couvertSuggested > 0`) e configura o **toggle de 10% gorjeta** conforme `tipSuggested`. O usuário pode deletar o item de couvert e alternar o toggle a qualquer momento. Detalhes em 3.4 e 3.9.

- *Validações:**
- Nome **obrigatório** (não pode ser vazio). Sem mínimo ou máximo de caracteres.
- *Cenários adicionais:**
- Editar mesa após criada (mudar nome, ativar/desativar 10%, alterar couvert) — **só adm**
- Cadastrado já está em outra mesa (`currentTableId != null`): botão **Criar mesa** mostra modal "Você precisa sair da mesa atual primeiro" → leva pra mesa atual.
- --

### 3.3 Entrar na mesa via link/QR

#### 3.3a Como Anônimo

1. Acessa link `https://split-play.web.app/mesa/{tableId}` ou escaneia QR

2. Tela "Entrar na mesa":

- Nome (obrigatório)

- Escolha de avatar preset (fem/masc)

3. Firebase Auth: cria UID anônimo (`signInAnonymously`)

4. Sistema adiciona o uid em `tables/{tableId}/participants/{uid}` com nome e avatar preset

5. Sistema **auto-adiciona** o couvert como item individual do usuário (se `mesa.couvertSuggested > 0`); usuário pode deletar como qualquer item

6. Toggle de **10% gorjeta** começa ligado se `mesa.tipSuggested == true`, desligado caso contrário (cálculo live no breakdown)

7. Redireciona pra tela da mesa

#### 3.3b Como Cadastrado

1. Acessa link/QR

2. Se já logado: entra direto na mesa

3. Se não logado: tela de login → após auth, entra na mesa

4. Sistema **auto-adiciona** o couvert como item individual (se sugerido) e configura o toggle de 10% conforme `mesa.tipSuggested`

5. Redireciona pra tela da mesa

- *Cenários adicionais:**
- Mesa não existe (link errado) → erro 404 amigável
- Mesa já encerrada → mensagem "essa mesa foi encerrada"
- Limite de participantes: usa o que o Firebase suportar (sem limite "pequeno" no app)
- Fechou o navegador e voltou: **auto-rejoin** — Firebase Auth persiste em IndexedDB, app lê `currentTableId` e leva direto pra mesa
- Mesmo usuário em duas abas: **última ação ganha** — Firestore sincroniza em tempo real entre tabs, sem enforcement de single-session
- Cadastrado entrou como anônimo (clicou no fluxo errado): **sem aviso** — usuário pode fazer login depois pelo menu inferior; sistema deixa ele perceber sozinho
- --

### 3.4 Adicionar item

1. Participante (anônimo ou cadastrado) clica em **Adicionar item** na própria tela

2. Preenche:

- Nome

- Quantidade

- Valor (digitado pelo próprio participante)

- Toggle **compartilhar com**

- Se ativado: lista checkable de outros participantes (1 ou mais)

3. Sistema cria `tables/{tableId}/items/{itemId}` vinculado ao `ownerUid`

- *Item NÃO compartilhado (individual):**
- Estado nasce `confirmado` (auto-aceito)
- Owner pode **editar** ou **excluir** até a conta ser paga
- Aparece somente no perfil do owner
- *Item compartilhado:**
- Estado nasce `aguardando_aceite`
- Status `aguardando_aceite` é visível **só para o owner**
- Notificação push pra cada selecionado
- Ver fluxo 3.5 abaixo
- *Couvert e 10% gorjeta — modelos diferentes:**
- **Couvert**: **auto-adicionado** como item individual ao entrar na mesa (se `mesa.couvertSuggested > 0`). Aparece junto com os demais itens do usuário. Usuário pode **deletar** como qualquer outro item se não quiser. Valor é editável também.
- **10% gorjeta**: **NÃO** é um item — é um **toggle** no nível do participante (`participants/{uid}.tipEnabled`). Calculado **live** sobre o consumo atual do usuário e exibido como linha computada no breakdown da mesa (ex: "10% gorjeta: R$8,50"). Default ligado se `mesa.tipSuggested == true`. Usuário pode alternar a qualquer momento; o valor recalcula automaticamente.
- *Cenários adicionais:**
- Item pode ser editado/excluído mesmo depois que outros pagaram (ver modelo de snapshot em **2.5**). Excluir item já parcialmente pago não devolve dinheiro — UI deve avisar.
- Validações: quantidade > 0, valor > 0
- Item compartilhado **sempre divide igualmente** entre os divisores aceitos (sem ponderação)
- --

### 3.5 Compartilhar item — fluxo de aceite

1. Owner adiciona item compartilhado com [B, C]. Item nasce `aguardando_aceite` — visível **só** no perfil do owner como pendente.

2. B e C recebem notificação pop: "Maria quer dividir Pizza com você. Aceitar?"

3. Cada um responde: **Aceitar** ou **Recusar**

4. Quando todos os selecionados respondem, o sistema finaliza a divisão:

- **Algum recusou + outros aceitaram**: valor dividido entre **owner + aceitos**. Item passa a `confirmado` e aparece no perfil de cada participante da divisão.

- **Todos recusaram**: owner paga sozinho. Item passa a `confirmado` apenas no perfil do owner.

- **Todos aceitaram**: divide entre owner + todos.

- *Cenários adicionais:**
- Timeout: B não responde em **2 horas** → **assume recusa** automaticamente
- B aceita e depois quer **retratar**: permitido — UI avisa "se alguém já pagou esse item, sua saída vai aumentar a cota dos divisores não pagos"
- Owner cancela o convite antes de qualquer resposta
- B sai da mesa antes de responder — assume recusa
- Re-propor divisão (owner edita item após decisões)
- *Recalcular divisores depois de aceito (mesa em andamento):**
- **Adicionar D** a item já dividido entre [A,B,C]: D passa pelo fluxo de aceite acima. Se aceitar, entra como divisor — cota recalcula via modelo de snapshot (ver **2.5**).
- **Remover C** (não comeu, ou saiu da mesa antes de pagar): owner remove C da divisão; valor restante redistribui entre os divisores não pagos. Quem já pagou não é afetado.
- --

### 3.6 Navegação (menu inferior)

| Aba | Conteúdo |

|---|---|

| **Home** | Histórico de mesas que o usuário participou + saldo de moedas. **Não** mostra mesas abertas em tempo real (privacidade + evita refresh constante). |

| **Mesa** | Sempre acessível. Se `currentTableId == null`: tela "Entrar em mesa" (escanear QR ou digitar código). Se em mesa: tela da mesa atual. |

| **Avatar** | Sempre acessível. Permite editar avatar (anônimos têm acesso limitado — sem loja, só veem o preset). |

| **Perfil** | Sempre acessível. Cadastrado: nome, moedas, configurações, editar/excluir conta. Anônimo: vê CTA **Criar conta** em destaque. |

- --

### 3.7 Anônimo cria conta dentro da mesa

1. Anônimo clica em "Criar conta pra personalizar avatar" (CTA na aba Avatar ou no perfil)

2. Preenche e-mail/senha (ou Google)

3. Firebase Auth: `linkWithCredential` — converte UID anônimo em conta permanente, **preservando** o UID

4. Sistema:

- Cria/atualiza `users/{uid}` com bônus de 10 moedas

- Mantém `currentTableId` (continua na mesa)

- Avatar atual (preset) vira o avatar default; usuário pode personalizar

5. Continua na mesa como Cadastrado

- *Cenários adicionais:**
- E-mail já tem conta cadastrada com outro UID — não dá pra linkar. Sistema oferece **fazer login** com essa conta. Usuário **permanece na mesa** autenticado pela conta existente (perde o estado anônimo: avatar preset e UID anônimo são descartados; passa a usar avatar/moedas da conta logada).
- --

### 3.8 Personalização do avatar e loja

O avatar é um retrato (cabeça/ombros, estilo DrawKit). Cada peça é um SVG em `split_play/assets/` e o ID guardado em `users/{uid}.avatar.{slot}` é o nome do arquivo sem extensão (ex: `Hair_Style_03`). Slots:

| Slot (campo) | Obrigatório | Pasta de assets |

|---|---|---|

| `backgroundId` | sim | `assets/background-svgs/` |

| `skinId` | sim | `assets/face/` (prefixo `Face_Skin_`) |

| `eyesId` | sim | `assets/olhar/` |

| `mouthId` | sim | `assets/boca-svgs/` |

| `hairId` | sim | `assets/cabelos/` |

| `beardId` | opcional | `assets/face/` (prefixo `Face_Beard_`) |

| `glassesId`, `hatId`, `earringId`, `maskId`, `moustacheId`, `earphoneId` | opcionais | `assets/acessorios/` |

1. Cadastrado vai na aba Avatar

2. Vê avatar atual em destaque + abas de categoria (uma por slot)

3. Em cada categoria:

- Itens possuídos: pode equipar/desequipar (slots opcionais podem ficar vazios)

- Itens não possuídos: mostra preço em moedas

- Botão **Preview**: vê o item aplicado no próprio avatar antes de decidir

- Botão **Comprar** (desabilitado se moedas insuficientes)

4. Comprar:

- **Pop-up de confirmação**: "Comprar [item] por X moedas?" → Confirmar / Cancelar

- Ao confirmar: transação atômica → deduz moedas → adiciona em `ownedItemIds` → equipa automaticamente

5. Equipar item já possuído: atualiza `users/{uid}.avatar.{slot}Id`

- *Decisões aplicadas:**
- Preview disponível antes de comprar
- Toda compra exige pop-up de confirmação (independente do valor)
- **Sem histórico de transações** de moedas (decisão MVP)
- **Sem itens promocionais/limitados** (decisão MVP)
- Slots de acessório são independentes: usuário pode combinar óculos + chapéu + brinco ao mesmo tempo
- Os slots obrigatórios (background, skin, eyes, mouth, hair) já vêm equipados desde o cadastro via preset
- *Como ganhar moedas:**
- Cadastro: **10 moedas** (bônus único)
- **Entrar** em uma mesa: **5 moedas**
- **Pagar** a conta da mesa: **15 moedas** (total de 20 por mesa concluída)
- *Faixa de preço dos itens da loja (3 tiers):**

| Tier | Preço | Quando o usuário consegue comprar |

|---|---|---|

| **Default** | 0 | Já equipado desde o cadastro (presets) |

| **Básico** | 30-50 | Após 1-2 mesas |

| **Comum** | 100-150 | Após 5-7 mesas |

| **Raro** | 250-400 | Após 12-20 mesas (aspiracional) |

- *Progressão esperada** (com bônus 10 + 20 por mesa):
- Após 1 mesa: 30 moedas → 1ª peça básica
- Após 5 mesas: 110 moedas → 1ª peça comum
- Após 15 mesas: 310 moedas → 1ª peça rara
- *Catálogo atual de assets** (base do tiering a ser definida na issue 04):

| Slot | Assets disponíveis |

|---|---|

| Background | 4 |

| Skin | 4 (tons fair → darker) |

| Eyes | 6 (normal, angry, closed, cynic, sad, thin) |

| Mouth | 4 (cute, angry, hate, sad) |

| Hair | 23 |

| Beard | 1 |

| Glasses | 4 (normal, futuristic, rounded, stylish) |

| Hat | 1 (cap) |

| Earring | 3 (normal, circle, simple) |

| Mask | 2 (normal, google) |

| Moustache | 1 |

| Earphone | 1 |

- --

### 3.9 Pagar conta

1. Participante (anônimo ou cadastrado) clica em **Pagar conta**

2. Sistema mostra breakdown:

- Itens individuais (incluindo couvert se não foi deletado): lista + valor

- Itens compartilhados: lista + fração + valor

- **10% gorjeta** (linha computada se `tipEnabled == true`)

- **Total a pagar**

3. **Pop-up de confirmação:** "Confirmar pagamento de R$X? Esta operação **não pode ser revertida**."

4. Ao confirmar → transação Firestore que:

- Para cada item compartilhado do usuário: aplica snapshot (`valorRestante -= cota`, remove uid dos `divisores`). Ver **2.5**.

- Snapshot do total pago (incluindo 10% se ligado) é registrado em `participants/{uid}.paidAmount`

- Marca `participants/{uid}.paid = true` e `paidAt = serverTimestamp`

5. Subtrai do total da mesa

6. Se **todos os participantes** estão `paid = true` → mesa encerra automaticamente

- *Decisões aplicadas:**
- Pagamento é **irreversível** — nem usuário nem adm conseguem reverter
- **Sem pagamento parcial** — sempre o valor individual completo
- Quem quer consumir mais depois de pagar: **paga e entra na mesa novamente** como novo participante (recebe novo couvert se aplicável)
- *Cenários adicionais:**
- Sair da mesa sem pagar: pendência registrada como "saída sem pagar" (ver 3.10 e 3.12)
- --

### 3.10 Encerrar mesa

#### 3.10a Por adm

1. Adm clica em **Encerrar mesa**

2. **Pop-up de confirmação:** "Encerrar mesa? Pendências de pagamento ficarão como 'saída sem pagar'. Esta ação **não pode ser desfeita**."

3. Mesa muda pra `status = 'encerrada'`

4. Bloqueia: novos participantes, novos itens, novas divisões

5. **Pendências viram "saída sem pagar"** — não há cobrança redistribuída entre os pagos. O app marca o status, resolução fica fora do app.

#### 3.10b Automático

- Trigger: ao marcar último participante como `paid`, sistema fecha mesa
- *Decisões aplicadas:**
- Mesa encerrada **nunca reabre**
- Encerrar com pendências: cada pendente fica registrado como "saída sem pagar"; nenhum participante pago é onerado por essas pendências (diferente do caso "remover participante mid-mesa", ver 3.12)
- --

### 3.11 Transferir adm

1. Adm atual abre lista de participantes

2. Seleciona um participante **Cadastrado que ainda está na mesa** (anônimos e quem saiu não são elegíveis — não aparecem na lista)

3. Sistema dispara **pop-up para o candidato a novo adm**: "Maria quer transferir o adm pra você. Aceitar?"

4. Se aceitar:

- Atualiza `tables/{tableId}.adminUid`

- Antigo adm vira participante normal

- Novo adm pode repassar pra outra pessoa depois

5. Se recusar: adm continua com o atual; mensagem informa o proponente

- *Decisões aplicadas:**
- Adm desconectado/com perda de conexão: sistema **auto-promove** o próximo cadastrado (heurística: primeiro cadastrado a entrar na mesa). Quando o adm original volta, vira participante normal.
- Não é possível transferir pra quem saiu da mesa
- Novo adm precisa **aceitar via pop-up**
- *Cenários adicionais:**
- Pop-up de aceite ignorado: timeout de **5 minutos** → expira; adm proponente recebe aviso e pode escolher outro candidato. Cancelamento manual antes do timeout também é possível.
- --

### 3.12 Editar mesa (apenas Adm)

Ações disponíveis pro adm:

- Mudar nome
- Ativar/desativar 10%
- Alterar couvert
- **Remover participante** (kick)

#### Remover participante X (mid-mesa)

Quando o adm remove X **antes** de X pagar:

1. Itens individuais de X (incluindo o item de couvert auto-adicionado, se ainda existir): **deletados**

2. X removido de `divisores` em itens compartilhados — modelo de snapshot (2.5) recalcula automaticamente para os divisores restantes

3. Toggle de 10% de X é descartado junto com X

4. X é removido de `tables/{tableId}/participants`

> **Sem redistribuição especial de couvert:** o couvert de X é um item dele (auto-adicionado ao entrar). Removendo X, o item dele some. Os outros participantes mantêm seus próprios couverts (auto-adicionados quando eles entraram).

Quando X **já pagou** antes da remoção: snapshot fica registrado, X sai da mesa, nada muda nas contas dos demais.

(Mesma lógica se aplica se participante regular sair voluntariamente.)

#### Editar couvert/10% sugeridos da mesa

- Adm pode mudar `couvertSuggested` e `tipSuggested` a qualquer momento
- **Não afeta** os itens de couvert já auto-adicionados aos participantes existentes (quem já entrou, mantém o que recebeu); também não muda toggles de 10% já configurados
- **Novos participantes** que entrarem após a edição recebem o auto-add com os valores atualizados
- --

## 4. Cenários transversais (qualquer fluxo)

- **Conexão perdida** no meio de uma operação — Firestore tem suporte offline; ações ficam pendentes e sincronizam ao reconectar. Avisar usuário visualmente.
- **Múltiplos dispositivos** com o mesmo UID — anônimo abriu em duas abas, cadastrado abriu no celular e laptop. Estado deve ser consistente via Firestore stream.
- **Notificações negadas** pelo navegador/sistema — fallback in-app (badge na aba, lista de pendências)
- **Hora do dispositivo errada** — usar `serverTimestamp` em todos os campos sensíveis
- **Quota Firebase / outage** — mostrar erro amigável, retry
- **Race conditions críticas** — usar transações Firestore em: dedução de moedas, pagamento, fechamento de mesa, transferência de adm
- --