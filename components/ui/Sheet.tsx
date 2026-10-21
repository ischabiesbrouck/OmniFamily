'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/**
 * Bottom sheet on phones, centred dialog from `sm` up. Radix handles focus trapping,
 * Escape, scroll locking and aria wiring.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[2rem] bg-surface shadow-float sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem] ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
        >
          <div
            className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-line sm:hidden"
            aria-hidden="true"
          />
          <div className="flex items-start gap-3 px-5 pt-3 sm:px-6 sm:pt-6">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-2xl font-semibold tracking-tight">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-muted">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              aria-label={t('close')}
              className="-mt-1 inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 hover:brightness-95"
            >
              <X aria-hidden="true" className="size-5" />
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
