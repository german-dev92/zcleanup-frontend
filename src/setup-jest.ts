import 'jest-preset-angular/setup-jest';
import '@testing-library/jest-dom';

/**
 * @file src/setup-jest.ts
 * @description Configuración inicial para Jest en Angular.
 * Este archivo:
 * 1. Carga los mocks necesarios para que Angular funcione en un entorno de Node (sin navegador).
 * 2. Agrega las validaciones de 'jest-dom' (como expect(el).toBeVisible()).
 */

Object.defineProperty(window, 'CSS', { value: null });
Object.defineProperty(window, 'getComputedStyle', {
  value: () => {
    return {
      display: 'none',
      appearance: ['-webkit-appearance'],
    };
  },
});

Object.defineProperty(document, 'doctype', {
  value: '<!DOCTYPE html>',
});
Object.defineProperty(document.body.style, 'transform', {
  value: () => {
    return {
      enumerable: true,
      configurable: true,
    };
  },
});
