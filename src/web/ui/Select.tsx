import * as RadixSelect from '@radix-ui/react-select';
import { clsx } from 'clsx';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  /** Opção visível mas não escolhível (ex.: o mesmo perfil já escolhido no outro lado). */
  disabled?: boolean;
}

export interface SelectProps {
  /** Rótulo visível e nome acessível (ex.: "Perfil"). */
  label: string;
  options: readonly SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

function uncontrolledOr(value: string | undefined, initial: string | undefined) {
  if (value !== undefined) return { value };
  return initial !== undefined ? { defaultValue: initial } : {};
}

export function Select({ label, options, value, defaultValue, onValueChange, className }: SelectProps) {
  return (
    <RadixSelect.Root
      {...uncontrolledOr(value, defaultValue ?? options[0]?.value)}
      {...(onValueChange ? { onValueChange } : {})}
    >
      <RadixSelect.Trigger
        aria-label={label}
        className={clsx(
          'inline-flex h-10 items-center gap-2 rounded-[10px] border border-control bg-transparent px-3.5 text-[14px] text-ink-2 transition-colors hover:bg-surface-2',
          className,
        )}
      >
        <span aria-hidden="true">{label}</span>
        <span className="font-semibold text-ink">
          <RadixSelect.Value />
        </span>
        <RadixSelect.Icon>
          <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[10px] border border-line bg-surface p-1"
        >
          <RadixSelect.Viewport>
            {options.map((o) => (
              <RadixSelect.Item
                key={o.value}
                value={o.value}
                {...(o.disabled ? { disabled: true } : {})}
                className="relative flex h-9 cursor-default items-center rounded-md pr-3 pl-7 text-[14px] text-ink outline-none data-[disabled]:text-ink-2 data-[disabled]:opacity-60 data-[highlighted]:bg-surface-2"
              >
                <RadixSelect.ItemIndicator className="absolute left-2">
                  <Check size={14} strokeWidth={2} aria-hidden="true" />
                </RadixSelect.ItemIndicator>
                <RadixSelect.ItemText>{o.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
