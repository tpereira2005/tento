import { clsx } from 'clsx';

/**
 * Símbolo do Tento: um tento (ficha) pousado sobre a linha do zero.
 * O anel é um recorte (evenodd), por isso funciona sobre qualquer fundo.
 */
export const MARK_TOKEN_PATH =
  'M9 21a15 15 0 1 0 30 0a15 15 0 1 0 -30 0Z M14 21a10 10 0 1 0 20 0a10 10 0 1 0 -20 0Z M17 21a7 7 0 1 0 14 0a7 7 0 1 0 -14 0Z';
export const MARK_RULE = { x: 5, y: 40, width: 38, height: 3.5 } as const;

interface MarkProps {
  size?: number;
  className?: string;
}

export function Mark({ size = 28, className }: MarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      className={clsx('shrink-0', className)}
    >
      <path d={MARK_TOKEN_PATH} fillRule="evenodd" fill="var(--pos)" />
      <rect {...MARK_RULE} rx={1} fill="var(--ink)" />
    </svg>
  );
}

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: { mark: 22, text: 'text-[22px]' },
  md: { mark: 28, text: 'text-[26px]' },
  lg: { mark: 72, text: 'text-[88px]' },
};

/** Símbolo + nome. O nome é texto real (acessível e selecionável). */
export function Logo({ size = 'md', className }: LogoProps) {
  const s = SIZES[size];
  return (
    <span className={clsx('inline-flex items-center gap-2.5 text-ink', className)}>
      <Mark size={s.mark} />
      <span
        className={clsx('font-display leading-none tracking-[-0.02em]', s.text)}
        style={{ fontVariationSettings: "'SOFT' 50, 'opsz' 144" }}
      >
        Tento
      </span>
    </span>
  );
}
