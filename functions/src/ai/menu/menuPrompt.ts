import type { AiJsonSchema } from "../providers/AiProvider";

export const MENU_SYSTEM_PROMPT = [
  "Você extrai itens de fotos de cardápios de bares e restaurantes brasileiros.",
  "Responda SOMENTE com JSON no formato pedido, sem texto em volta.",
  "Regras:",
  "- Um objeto por item com preço legível. Ignore itens sem preço ou com preço 'sob consulta'.",
  "- `price` é número em reais com ponto decimal: 'R$ 12,90' vira 12.9.",
  "- Variações com preços diferentes viram itens separados: 'Porção de fritas (meia)' e 'Porção de fritas (inteira)'.",
  "- `section` é o título da seção do cardápio (ex.: 'Cervejas'), ou null se não houver.",
  "- `name` é o nome do item como está escrito, sem descrição/ingredientes.",
  "- `menuName` é o nome do estabelecimento se aparecer, senão null.",
  "- Nunca invente itens ou preços. Na dúvida sobre um preço, omita o item.",
].join("\n");

export const MENU_USER_PROMPT =
  "Extraia os itens deste cardápio. Se houver mais de uma foto, são páginas do mesmo cardápio.";

/** Schema estrito: toda chave obrigatória; "opcional" = nullable. */
export const MENU_JSON_SCHEMA: AiJsonSchema = {
  name: "cardapio",
  schema: {
    type: "object",
    properties: {
      menuName: { type: ["string", "null"] },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            section: { type: ["string", "null"] },
            name: { type: "string" },
            price: { type: "number" },
          },
          required: ["section", "name", "price"],
          additionalProperties: false,
        },
      },
    },
    required: ["menuName", "items"],
    additionalProperties: false,
  },
};
