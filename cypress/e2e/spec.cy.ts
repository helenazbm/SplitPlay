describe('initial spec', () => {
  it('passes', () => {
    cy.visit('https://splitplay-app.vercel.app/')
  })
})

describe('create an account', () => {
  it('clicking "criar conta"', () => {
    cy.contains('criar conta').click()
    cy.url().should('include', 'sigup')

    cy.get('[data-cy="email"]').type('teste@email.com')
    cy.get('[data-cy="username"]').type('teste')
    cy.get('[data-cy="password"]').type('teste@0202')

    cy.get('[data-cy="enter-button"]').click()

  })
})