describe('user flow', () => {

  it('Describes the flow of add an item', () => {
    let tableId
    let valores = Number((Math.random() * 100).toFixed(2))

    cy.clearCookies()
    cy.clearLocalStorage(/firebase/)

    cy.visit('/')

    cy.window().then((win) => {
      Object.keys(win.localStorage).forEach((key) => {
        if (key.includes('firebase')) {
          win.localStorage.removeItem(key)
        }
      })
    })

    cy.reload()

    cy.get('[data-cy="entrarmesa"]', { timeout: 10000 })
      .should('be.visible')
      .click()
    cy.url().should('include', 'mesa/entrar')

    cy.task('getTableId').then((tableId) => {
      cy.log('tableId recebido:', String(tableId))
      cy.get('[data-cy="codigomesa"]')
        .clear()
        .type(String(tableId), { delay: 100 })
        .should('have.value', String(tableId))
    })

    cy.get('[data-cy="botaoentrarmesa"]').click()

    cy.get('[data-cy="seunome"]').type('nominho')
    cy.get('[data-cy="entrarnamesa"]').click()

    cy.get('[data-cy="additem"]', { timeout: 10000 }).click()
    cy.get('[data-cy="nomeitem"]').type('pizza')
    cy.get('[dataa-cy="valoritem"]').type(valores.toString())
    cy.get('[data-cy="adicionaritemdefato"]').click()
    
  })
})