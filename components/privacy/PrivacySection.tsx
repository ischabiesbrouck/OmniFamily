'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { getRepositories } from '@/lib/db/repositories';
import { useSetting } from '@/lib/db/repositories/hooks';
import { deleteEverything, exportVault } from '@/lib/db/repositories/vault';
import { INTAKE_CONSENT_KEY, isConsent, revokeConsent } from '@/lib/intake/consent';
import { withBase } from '@/lib/pwa/basePath';
import { todayIn } from '@/lib/time/zoned';

/** SPEC §7: consent withdrawal, data export (Art. 20) and erasure (Art. 17). */
export function PrivacySection({ intakeEnabled }: { intakeEnabled: boolean }) {
  const t = useTranslations('privacy');
  const format = useFormatter();
  const consent = useSetting(INTAKE_CONSENT_KEY);
  const db = getRepositories().core.db;

  async function download() {
    const vault = await exportVault(db);
    const blob = new Blob([JSON.stringify(vault, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `omnifamily-vault-${todayIn('UTC')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function erase() {
    if (!window.confirm(t('deleteConfirm'))) return;
    await deleteEverything(db);
    window.location.replace(withBase('/onboarding'));
  }

  return (
    <section aria-labelledby="privacy-heading" className="flex flex-col gap-4">
      <h2 id="privacy-heading" className="text-xl font-semibold">
        {t('title')}
      </h2>
      <p>{t('intro')}</p>

      {intakeEnabled && (
        <div className="flex flex-col gap-2">
          <h3 className="font-semibold">{t('intakeConsent')}</h3>
          {isConsent(consent) ? (
            <>
              <p>
                {t('consentGiven', {
                  date: format.dateTime(consent.grantedAt, { dateStyle: 'medium' }),
                })}
              </p>
              <Button
                variant="secondary"
                className="self-start"
                onClick={() => void revokeConsent(db)}
              >
                {t('withdraw')}
              </Button>
            </>
          ) : (
            <p>{t('consentNone')}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p>{t('exportHint')}</p>
        <Button variant="secondary" className="self-start" onClick={() => void download()}>
          {t('export')}
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        <p>{t('deleteHint')}</p>
        <Button variant="danger" className="self-start" onClick={() => void erase()}>
          {t('delete')}
        </Button>
      </div>
    </section>
  );
}
