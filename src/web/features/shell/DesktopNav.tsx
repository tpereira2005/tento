import { Link } from '@tanstack/react-router';
import { clsx } from 'clsx';
import { t } from '../../i18n';
import { desktopNav } from './nav';

/** Navegação principal da barra superior, com o item ativo em pílula (`aria-current="page"`). */
export function DesktopNav() {
  return (
    <nav aria-label={t().nav.label} className="hidden md:block">
      <ul className="flex items-center gap-0.5">
        {desktopNav().map((item) => (
          <li key={item.to} className={clsx(item.to === '/definicoes' && 'hidden lg:block')}>
            <Link
              to={item.to}
              activeOptions={{ exact: item.to === '/' }}
              className="inline-flex h-9 items-center rounded-full px-3 text-[14px] text-ink-2 transition-colors hover:text-ink data-[status=active]:bg-pill data-[status=active]:font-semibold data-[status=active]:text-pill-ink"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
