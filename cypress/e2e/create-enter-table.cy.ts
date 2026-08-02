describe('initial spec', () => {
  it('passes', () => {
    cy.visit('/')
  })
})

describe('admin user flow', () => {
  it('Describes the flow of an admin user creating and entering a table.', () => {
    let numero = Math.floor(Math.random() * 1000)
    let valores = Number((Math.random() * 50).toFixed(2))
    let tableId

    cy.visit('/')
    cy.get('[data-cy="criarconta"]').click()
    cy.url().should('include', 'signup')

    cy.get('[data-cy="email"]').type(`teste${numero}@gmail.com`)
    cy.get('[data-cy="username"]').type('teste2')
    cy.get('[data-cy="password"]').type('teste@0202')

    cy.get('[data-cy="enter-button"]').click()

    cy.get('[data-cy="criarmesa"]').click()
    cy.url().should('include', '/mesa/criar')

    cy.get('[data-cy="nomemesa"]').type('aniversario teste')
    cy.get('[data-cy="criarmesabutton"]').click()

    cy.get('[data-cy="taxa"]').type(valores.toString())

    cy.get('[data-cy="criarmesa2"]').click()

    cy.url()
      .should('not.include', '/mesa/criar')
      .then((url) => {
        const tableId = url.split('/mesa/')[1]

        cy.log(`salvando: ${tableId}`)

        cy.task('setTableId', tableId)
    })

    cy.get('[data-cy="irpmesa"]').click()

    cy.get('[data-cy="perfil"]').click()
    cy.get('[data-cy="sair"').click()

    cy.wait(3000)
    
  })
})

describe('user flow', () => {

  it('Describes the flow of an user entering a table.', () => {
    let tableId

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
    
  })
})
