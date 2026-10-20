'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/** Plain-language, opt-in consent before the first AI intake call (SPEC §7.1). */
export function ConsentDialog({
  open,
  onAllow,
  onDecline,
}: {
  open: boolean;
  onAllow: () => void;
  onDecline: () => void;
}) {
  const t = useTranslations('intake.consent');
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onDecline()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/50" />
        <Dialog.Content className="fixed inset-x-0 bottom-0 flex max-h-[90dvh] flex-col gap-3 overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
          <Dialog.Title className="text-xl font-semibold">{t('title')}</Dialog.Title>
          <Dialog.Description>{t('intro')}</Dialog.Description>
          <ul className="flex list-disc flex-col gap-2 pl-5">
            <li>{t('what')}</li>
            <li>{t('retention')}</li>
            <li>{t('children')}</li>
            <li>{t('revoke')}</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={onAllow}>{t('allow')}</Button>
            <Button variant="secondary" onClick={onDecline}>
              {t('decline')}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
