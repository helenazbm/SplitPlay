/** Resposta do MockProvider para leitura de cardápio (perfil "mock" / emulador sem chave). */
export const MENU_MOCK_RESPONSE = JSON.stringify({
  menuName: "Bar de Exemplo",
  items: [
    { section: "Cervejas", name: "Long neck", price: 12.9 },
    { section: "Cervejas", name: "Cerveja 600ml", price: 16 },
    { section: "Drinks", name: "Caipirinha", price: 18 },
    { section: "Petiscos", name: "Porção de fritas (meia)", price: 25 },
    { section: "Petiscos", name: "Porção de fritas (inteira)", price: 40 },
    { section: null, name: "Água mineral", price: 5 },
  ],
});
