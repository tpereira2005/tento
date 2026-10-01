import { Link, useRouterState } from '@tanstack/react-router';
import { Ellipsis, LogOut } from 'lucide-react';
import { useState } from 'react';
import { t } from '../../i18n';
import { Sheet } from '../../ui';
import { mobileTabs, moreItems } from './nav';
import { useSignOut } from './useSignOut';

const TAB =
  'group flex min-h-16 w-full flex-col items-center justify-center gap-1 text-[11px] text-ink-2 hover:text-ink data-[status=active]:font-semibold data-[status=active]:text-ink';
const ICON_PILL =
  'grid h-7 w-12 place-items-center rounded-full transition-colors group-data-[status=active]:bg-pos-tint group-data-[status=active]:text-pos';

/** Separadores fixos em baixo (só no móvel): quatro secções e "Mais". */
export function BottomTabs() {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const moreActive = moreItems().some((i) => pathname === i.to || pathname.startsWith(`${i.to}/`));
  const { signOut, pending } = useSignOut();
  const n = t();

  return (
    <nav
      aria-label={n.nav.label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {mobileTabs().map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              activeOptions={{ exact: item.to === '/', includeSearch: false }}
              className={TAB}
            >
              <span className={ICON_PILL}>
                <item.icon size={20} strokeWidth={1.8} aria-hidden={true} />
              </span>
              {item.label}
            </Link>
          </li>
        ))}
        <li>
          <Sheet
            title={n.shell.moreTitle}
            description={n.shell.moreDescription}
            open={moreOpen}
            onOpenChange={setMoreOpen}
            trigger={
              <button type="button" className={TAB} data-status={moreActive ? 'active' : undefined}>
                <span className={ICON_PILL}>
                  <Ellipsis size={20} strokeWidth={1.8} aria-hidden={true} />
                </span>
                {n.nav.more}
              </button>
            }
          >
            <ul className="flex flex-col">
              {moreItems().map((item) => (
                <li key={item.to} className="border-t border-line first:border-t-0">
                  <Link
                    to={item.to}
                    onClick={() => {
                      setMoreOpen(false);
                    }}
                    className="flex min-h-12 items-center gap-3 text-[15px] data-[status=active]:font-semibold"
                  >
                    <item.icon size={18} strokeWidth={1.8} aria-hidden={true} />
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="border-t border-line">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setMoreOpen(false);
                    void signOut();
                  }}
                  className="flex min-h-12 w-full items-center gap-3 text-[15px] disabled:opacity-50"
                >
                  <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
                  {n.shell.signOut}
                </button>
              </li>
            </ul>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}
