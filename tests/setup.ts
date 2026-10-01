import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// Páginas como o Painel montam muitos componentes; em máquinas carregadas (CI, testes em paralelo)
// o tempo por omissão de 1 s nas esperas assíncronas (findBy, waitFor) tornava os testes instáveis.
configure({ asyncUtilTimeout: 5000 });

// O jsdom não implementa scrollTo (usado pela restauração de scroll do router): evita ruído nos registos.
if (typeof window !== 'undefined') {
  window.scrollTo = () => undefined;
}
