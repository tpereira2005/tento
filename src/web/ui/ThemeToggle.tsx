import { Moon, Sun } from 'lucide-react';
import { t } from '../i18n';
import { useTheme } from '../theme';

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const label = theme === 'dark' ? t().theme.toLight : t().theme.toDark;
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full border border-line text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
