describe('initial spec', () => {
  it('passes', () => {
    cy.visit('/')
  })
})

describe('admin user flow', () => {
  it('sescribes the flow of an admin user creating and entering a table.', () => {
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
    cy.url().then((url) => {
      tableId = url.split('/mesa/')[1]
      cy.wrap(tableId).as('tableId')
    })

    cy.get('[data-cy="irpmesa"]').click()
    
  })
})

/*
cy.get('@tableId').then((tableId) => {
  cy.log(tableId)

  cy.visit(`/mesa/entrar`)

  cy.get('[data-cy="codigo-mesa"]')
    .type(tableId)
})
*/