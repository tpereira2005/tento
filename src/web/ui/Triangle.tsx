import { clsx } from 'clsx';

export interface TriangleProps {
  direction: 'up' | 'down';
  size?: number;
  className?: string;
}

/** ▲/▼ em SVG (não depende de glifos da fonte). Cobalto para cima, coral para baixo. */
export function Triangle({ direction, size = 10, className }: TriangleProps) {
  const points = direction === 'up' ? '5,1 9.5,9 0.5,9' : '0.5,1 9.5,1 5,9';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      aria-hidden="true"
      className={clsx('shrink-0', direction === 'up' ? 'text-pos' : 'text-neg', className)}
    >
      <polygon points={points} fill="currentColor" />
    </svg>
  );
}
