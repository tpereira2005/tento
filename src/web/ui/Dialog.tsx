import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../i18n';

export interface DialogProps {
  title: string;
  description: string;
  /** Elemento que abre o diálogo (recebe o foco de volta ao fechar). */
  trigger?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Permite escolher onde fica o foco ao fechar (`event.preventDefault()` e focar à mão). */
  onCloseAutoFocus?: (event: Event) => void;
  children?: ReactNode;
}

export function Dialog({ title, description, trigger, children, onCloseAutoFocus, ...root }: DialogProps) {
  return (
    <RadixDialog.Root {...root}>
      {trigger ? <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger> : null}
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/50" />
        <RadixDialog.Content
          {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-line bg-surface p-6"
        >
          <RadixDialog.Title className="pr-10 font-display text-[22px] font-normal tracking-[-0.01em]">
            {title}
          </RadixDialog.Title>
          <RadixDialog.Description className="mt-2 text-ink-2">{description}</RadixDialog.Description>
          {children ? <div className="mt-5">{children}</div> : null}
          <RadixDialog.Close
            aria-label={t().common.close}
            className="absolute top-4 right-4 grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <X size={18} strokeWidth={1.8} aria-hidden="true" />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
