import { FileText, GitCompareArrows, House, ListOrdered, Settings, Upload } from 'lucide-react';
import type { ComponentType } from 'react';
import { t } from '../../i18n';

export type NavPath = '/' | '/transacoes' | '/importar' | '/comparar' | '/relatorios' | '/definicoes';

interface IconProps {
  size?: number;
  strokeWidth?: number;
  'aria-hidden'?: boolean;
}
export type NavIcon = ComponentType<IconProps>;

export interface NavItem {
  to: NavPath;
  label: string;
  icon: NavIcon;
}

/** Itens da navegação principal (barra superior no ecrã grande). */
export function desktopNav(): NavItem[] {
  const n = t().nav;
  return [
    { to: '/', label: n.dashboard, icon: House },
    { to: '/transacoes', label: n.transactions, icon: ListOrdered },
    { to: '/importar', label: n.import, icon: Upload },
    { to: '/comparar', label: n.compare, icon: GitCompareArrows },
    { to: '/relatorios', label: n.reports, icon: FileText },
    { to: '/definicoes', label: n.settings, icon: Settings },
  ];
}

/** Separadores de baixo no móvel; o resto fica em "Mais". */
export function mobileTabs(): NavItem[] {
  return desktopNav().slice(0, 4);
}

/** Secções que vivem no menu "Mais" do móvel. */
export function moreItems(): NavItem[] {
  return desktopNav().slice(4);
}
