import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { clsx } from 'clsx';
import { useState } from 'react';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedProps {
  'aria-label': string;
  options: readonly SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

/** Seleção única; não permite ficar sem valor (clicar no item ativo não o desliga). */
export function Segmented({
  'aria-label': ariaLabel,
  options,
  value,
  defaultValue,
  onValueChange,
  className,
}: SegmentedProps) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? '');
  const current = value ?? inner;
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={ariaLabel}
      value={current}
      onValueChange={(next) => {
        if (!next) return;
        setInner(next);
        onValueChange?.(next);
      }}
      className={clsx(
        'inline-flex h-10 items-center gap-0.5 rounded-[10px] border border-control p-[3px]',
        className,
      )}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="num h-8 rounded-[7px] px-3 text-[12px] text-ink-2 transition-colors hover:text-ink data-[state=on]:bg-pill data-[state=on]:font-medium data-[state=on]:text-pill-ink"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
