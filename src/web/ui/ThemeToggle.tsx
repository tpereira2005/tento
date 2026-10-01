import { Moon, Sun } from 'lucide-react';
import { t } from '../i18n';
import { applyTheme, useTheme, type Theme } from '../theme';

export interface ThemeToggleProps {
  /** Chamado depois de o tema local mudar (ex.: para o guardar nas definições). */
  onChange?: (theme: Theme) => void;
}

export function ThemeToggle({ onChange }: ThemeToggleProps) {
  const { theme } = useTheme();
  const label = theme === 'dark' ? t().theme.toLight : t().theme.toDark;
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={() => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        onChange?.(next);
      }}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
