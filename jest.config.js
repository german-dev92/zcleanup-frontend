/**
 * @file jest.config.js
 * @description Configuración de Jest para el Frontend (Angular).
 * Al igual que en el backend, Jest manejará la ejecución de los tests.
 * Usamos 'jest-preset-angular' para que Jest entienda los archivos .html y .scss de Angular.
 */

module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
  globalSetup: 'jest-preset-angular/global-setup',
  
  // Dónde buscar los tests
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  
  // Transformar archivos para que Jest los entienda
  transform: {
    '^.+\\.(ts|js|mjs|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  
  // Mapeo de rutas (importante si usas paths en tsconfig)
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
    '^app/(.*)$': '<rootDir>/src/app/$1',
    '^assets/(.*)$': '<rootDir>/src/assets/$1',
    '^environments/(.*)$': '<rootDir>/src/environments/$1',
  },
  
  // Cobertura de código
  // NOTE: Only collect coverage on explicit `npm run test:cov` runs.
  // `npm test` / `npm run test:watch` should be fast for the local dev loop.
  collectCoverage: false,
  coverageReporters: ['html', 'text', 'lcov'],
  coverageDirectory: 'coverage/zclean-up',
  
  // Ignorar estos archivos en la cobertura
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/src/environments/',
    '/src/app/core/api/', // Código generado por OpenAPI
    '\\.module\\.ts$',
    '\\.model\\.ts$',
    'main.ts',
    'test.ts'
  ],

  // Configuración de umbrales de cobertura (Thresholds)
  coverageThreshold: {
    global: {
      statements: 30,
      branches: 20,
      functions: 30,
      lines: 30,
    },
  },
};
