import { clsx } from 'clsx';
import type { ComponentProps, ComponentType } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Ícone opcional antes do texto (componente lucide-react). */
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean }>;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-cta text-cta-ink font-semibold enabled:hover:brightness-110',
  secondary: 'border border-control bg-transparent text-ink enabled:hover:bg-surface-2',
  // ação destrutiva: fundo no tom do texto negativo (mesmo contraste que `text-neg-text` sobre a superfície)
  danger: 'bg-neg-text text-surface font-semibold enabled:hover:brightness-110',
  quiet: 'bg-transparent text-ink-2 enabled:hover:bg-surface-2 enabled:hover:text-ink',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-10 px-4 text-[14px]',
  sm: 'h-8 px-3 text-[13px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-[10px] font-medium whitespace-nowrap transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {Icon ? (
        <Icon size={size === 'sm' ? 14 : 16} strokeWidth={1.8} className="shrink-0" aria-hidden={true} />
      ) : null}
      {children}
    </button>
  );
}
