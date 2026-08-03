describe('Item flow', () => {

  beforeEach(() => {
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
      cy.get('[data-cy="codigomesa"]')
        .clear()
        .type(String(tableId), { delay: 100 })
        .should('have.value', String(tableId))
    })

    cy.get('[data-cy="botaoentrarmesa"]')
      .should('not.be.disabled')
      .click()

    cy.get('[data-cy="seunome"]').type('nominho')

    cy.get('[data-cy="entrarnamesa"]')
      .should('not.be.disabled')
      .click()

  })

  it('Adds an item', () => {
    const valor = Number((Math.random() * 100).toFixed(2))

    cy.get('[data-cy="additem"]')
      .should('be.visible')
      .click()

    cy.get('[data-cy="nomeitem"]')
      .type('Pizza')

    cy.get('[dataa-cy="valoritem"]')
      .type(valor.toString())

    cy.get('[data-cy="adicionaritemdefato"]')
      .click()

    cy.contains('Pizza').should('exist')

    cy.get('[data-cy="perfil"]').click()
    cy.get('[data-cy="sair"').click()

    cy.wait(3000)
  })

  it('Removes an item', () => {
    const valor = Number((Math.random() * 100).toFixed(2))

    cy.get('[data-cy="additem"]', { timeout: 10000 })
      .should('be.visible')
      .click()

    cy.get('[data-cy="nomeitem"]')
      .type('Pizza')

    cy.get('[dataa-cy="valoritem"]')
      .type(valor.toString())

    cy.get('[data-cy="adicionaritemdefato"]')
      .click()

    cy.contains('Pizza').should('exist')

    cy.contains('Pizza')
      .parents('[data-cy="item"]')
      .within(() => {
        cy.get('[data-cy="removeritem"]').click()
      })

    cy.contains('Pizza').should('not.exist')
  })

})