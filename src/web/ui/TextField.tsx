import { clsx } from 'clsx';
import { useId } from 'react';
import type { ComponentProps } from 'react';

export interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
}

export function TextField({ label, hint, error, id, className, ...rest }: TextFieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-erro`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');
  return (
    <div className={clsx('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-[13px] font-medium">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={clsx(
          'h-10 rounded-[10px] border bg-transparent px-3.5 text-[14px] text-ink placeholder:text-ink-2',
          error ? 'border-neg-text' : 'border-control',
        )}
        {...rest}
      />
      {hint ? (
        <p id={hintId} className="text-[12px] text-ink-2">
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
