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
  actions,
  hero = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
  /** Extra header buttons, left of Close (e.g. Edit). */
  actions?: ReactNode;
  /** A large centred title (detail views). */
  hero?: boolean;
}) {
  const t = useTranslations('common');
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 animate-[fade-in_0.2s_ease-out] bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={`fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] animate-[sheet-up_0.32s_cubic-bezier(0.2,0.8,0.2,1)] flex-col rounded-t-[2rem] bg-surface shadow-float sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:animate-[pop-in_0.2s_ease-out] sm:rounded-[2rem] ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
        >
          <div
            className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-line sm:hidden"
            aria-hidden="true"
          />
          <div
            className={`flex items-start gap-3 px-5 pt-3 sm:px-6 sm:pt-6 ${hero ? 'flex-col' : ''}`}
          >
            {/* Detail views put the buttons in a row above a large centred title. */}
            <div
              className={`flex gap-2 ${hero ? 'w-full flex-row-reverse justify-between' : 'order-last'}`}
            >
              {actions}
              <Dialog.Close
                aria-label={t('close')}
                className="-mt-1 inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 hover:brightness-95"
              >
                <X aria-hidden="true" className="size-5" />
              </Dialog.Close>
            </div>
            <div className="min-w-0 flex-1 self-stretch">
              <Dialog.Title
                className={`font-semibold tracking-tight ${hero ? 'pt-2 text-center text-3xl text-balance sm:text-4xl' : 'text-2xl'}`}
              >
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 text-muted">{description}</Dialog.Description>
              )}
            </div>
          </div>
          <div className="overflow-y-auto px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
