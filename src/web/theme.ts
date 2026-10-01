import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tento:tema';

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => {
    observer.disconnect();
  };
}

/** Aplica e memoriza o tema (a memória é só uma conveniência: pode falhar sem consequências). */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // modo privado ou armazenamento bloqueado: o tema vale só para esta sessão
  }
}

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribe, readTheme, () => 'light' as const);
  const toggle = useCallback(() => {
    applyTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme]);
  return { theme, toggle };
}

/** Preferência guardada na conta: `system` segue o dispositivo. */
export type ThemePreference = Theme | 'system';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function hasStoredTheme(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' || stored === 'dark';
  } catch {
    return false;
  }
}

/**
 * Aplica a preferência da conta. `system` esquece a escolha local e segue o dispositivo.
 * Com `onlyIfUnset`, respeita uma escolha local já feita neste navegador (arranque da aplicação).
 */
export function applyPreference(preference: ThemePreference, options: { onlyIfUnset?: boolean } = {}): void {
  if (options.onlyIfUnset && hasStoredTheme()) return;
  if (preference === 'system') {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // sem armazenamento: nada a esquecer
    }
    document.documentElement.dataset.theme = systemTheme();
    return;
  }
  applyTheme(preference);
}
