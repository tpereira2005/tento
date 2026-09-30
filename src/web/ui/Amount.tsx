import { clsx } from 'clsx';
import { formatCents } from '../../core/format';
import { Triangle } from './Triangle';

export interface AmountProps {
  /** Valor em cêntimos inteiros. */
  cents: number;
  /** Mostra "+" nos positivos (o "−" dos negativos aparece sempre). */
  signed?: boolean;
  /** 'auto' colore pelo sinal; 'neutral' usa a cor do texto. */
  tone?: 'auto' | 'neutral';
  withTriangle?: boolean;
  variant?: 'mono' | 'display';
  className?: string;
}

/**
 * O sinal está sempre no texto (−) e o triângulo reforça a direção:
 * a cor nunca é o único indicador.
 */
export function Amount({
  cents,
  signed = false,
  tone = 'auto',
  withTriangle = false,
  variant = 'mono',
  className,
}: AmountProps) {
  const toneClass = tone === 'neutral' || cents === 0 ? 'text-ink' : cents > 0 ? 'text-pos' : 'text-neg-text';
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-[0.4em] whitespace-nowrap',
        variant === 'mono' ? 'num' : 'font-display font-light tracking-[-0.02em]',
        toneClass,
        className,
      )}
    >
      {withTriangle && cents !== 0 ? (
        <Triangle direction={cents > 0 ? 'up' : 'down'} size={variant === 'display' ? 22 : 9} />
      ) : null}
      <span>{formatCents(cents, { signed })}</span>
    </span>
  );
}
