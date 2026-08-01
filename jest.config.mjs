import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './', 
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleDirectories: ['node_modules', '<rootDir>/'],
  // Integração roda com emulators via `npm run test:integration`
  testPathIgnorePatterns: [
    '/node_modules/',
    '\\.integration\\.test\\.[jt]sx?$',
  ],
}

export default createJestConfig(customJestConfig)