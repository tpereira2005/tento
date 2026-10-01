import { clsx } from 'clsx';
import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';

export interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  /** Esconde o rótulo visualmente (continua disponível para leitores de ecrã). */
  hideLabel?: boolean;
  id?: string;
  /** Controlo dentro do campo, à direita (ex.: mostrar/esconder palavra-passe). */
  endAdornment?: ReactNode;
}

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  id,
  className,
  endAdornment,
  ...rest
}: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-erro`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className={clsx('text-[13px] font-medium', hideLabel && 'sr-only')}>
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={clsx(
            'h-10 w-full rounded-[10px] border bg-transparent px-3.5 text-[14px] text-ink placeholder:text-ink-2',
            endAdornment ? 'pr-11' : null,
            error ? 'border-neg-text' : 'border-control',
          )}
          {...rest}
        />
        {endAdornment ? (
          <div className="absolute inset-y-0 right-0 flex items-center">{endAdornment}</div>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} aria-live="polite" className="text-[12px] text-ink-2">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-[12px] font-medium text-neg-text">
          {error}
        </p>
      ) : null}
    </div>
  );
}
