import { useEffect } from 'react';
import { t } from '../../i18n';

/** Título do separador do navegador (WCAG 2.4.2): "Página · Tento". */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${t().app.name}`;
  }, [title]);
}
