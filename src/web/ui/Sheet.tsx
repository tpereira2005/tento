import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../i18n';

export interface SheetProps {
  title: string;
  description: string;
  trigger: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

/** Painel que sobe da base do ecrã (menu "Mais" no móvel). Foco preso e Escape fecham, como no Dialog. */
export function Sheet({ title, description, trigger, children, ...root }: SheetProps) {
  return (
    <RadixDialog.Root {...root}>
      <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-ink/50" />
        <RadixDialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-[14px] border border-b-0 border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <RadixDialog.Title className="pr-10 font-display text-[22px] font-normal tracking-[-0.01em]">
            {title}
          </RadixDialog.Title>
          <RadixDialog.Description className="mt-1 text-ink-2">{description}</RadixDialog.Description>
          <div className="mt-4">{children}</div>
          <RadixDialog.Close
            aria-label={t().common.close}
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <X size={18} strokeWidth={1.8} aria-hidden="true" />
          </RadixDialog.Close>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
