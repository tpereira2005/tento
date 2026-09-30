import { createFileRoute, Link } from '@tanstack/react-router';
import { t } from '../i18n';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const m = t().home;
  return (
    <section className="mx-auto max-w-2xl py-16">
      <p className="eyebrow">{t().app.tagline}</p>
      <h1 className="mt-3 font-display text-5xl font-light tracking-[-0.02em]">{m.title}</h1>
      <p className="mt-4 text-ink-2">{m.body}</p>
      <Link
        to="/componentes"
        className="mt-8 inline-block font-medium text-pos underline-offset-4 hover:underline"
      >
        {m.componentsLink} →
      </Link>
    </section>
  );
}
