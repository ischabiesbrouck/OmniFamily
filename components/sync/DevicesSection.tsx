'use client';

import { CheckCircle2, MonitorSmartphone, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { getRepositories } from '@/lib/db/repositories';
import { useHousehold, useLiveRecords, useSetting } from '@/lib/db/repositories/hooks';
import { withBase } from '@/lib/pwa/basePath';
import {
  isRelaySyncOn,
  RELAY_SYNC_KEY,
  relayUrls,
  setRelaySync,
} from '@/lib/sync/relay/config';
import { inviteLink } from '@/lib/sync/relay/inviteCode';
import type { Invite } from '@/lib/sync/relay/invite';
import type { RelayPool } from '@/lib/sync/relay/pool';
import { startHostPairing, type HostPairing } from '@/lib/sync/pairingFlow';
import { useSyncStore } from '@/stores/syncStore';
import { CodeInput } from './CodeInput';
import { errorKey, type SyncErrorKey } from './errors';
import { QrCode } from './QrCode';
import { SyncStatus } from './SyncStatus';

type LanStep =
  | { s: 'idle' }
  | { s: 'offer'; pairing: HostPairing }
  | { s: 'connecting'; checkCode: string }
  | { s: 'connected'; checkCode: string }
  | { s: 'error'; key: SyncErrorKey };

type InviteStep =
  | { s: 'idle' }
  | { s: 'creating' }
  | { s: 'open'; link: string; known: Set<string> }
  | { s: 'joined'; name: string }
  | { s: 'error' };

/** Settings → Devices: internet sync with one-scan invites (D-10.4) and LAN pairing (D3). */
export default function DevicesSection() {
  const t = useTranslations('sync');
  const household = useHousehold();
  const devices = useLiveRecords('device') ?? [];
  const relayOn = isRelaySyncOn(useSetting(RELAY_SYNC_KEY));
  const session = useSyncStore((s) => s.session);
  const [lan, setLan] = useState<LanStep>({ s: 'idle' });
  const [invite, setInvite] = useState<InviteStep>({ s: 'idle' });
  const active = useRef<{ pool: RelayPool; invite: Invite } | null>(null);
  const myName = devices.find((d) => d.id === household?.deviceId)?.name ?? t('defaultDeviceName');
  const core = getRepositories().core;
  const store = useSyncStore.getState;

  const closeInvite = (burn: boolean) => {
    const current = active.current;
    active.current = null;
    if (!current) return;
    void (burn ? current.invite.burn() : Promise.resolve()).finally(() => current.pool.close());
  };
  useEffect(() => () => closeInvite(false), []);

  // The new device's own record arrives through sync: that is our "joined" signal.
  const newcomer =
    invite.s === 'open' ? devices.find((d) => !d.revoked && !invite.known.has(d.id)) : undefined;
  useEffect(() => {
    if (!newcomer) return;
    setInvite({ s: 'joined', name: newcomer.name });
    closeInvite(true);
  }, [newcomer]);

  async function createInvite() {
    setInvite({ s: 'creating' });
    try {
      const [{ RelayPool }, { createInvite: create }] = await Promise.all([
        import('@/lib/sync/relay/pool'),
        import('@/lib/sync/relay/invite'),
      ]);
      const pool = new RelayPool(relayUrls());
      const created = await create(core, pool).catch((error: unknown) => {
        pool.close();
        throw error;
      });
      active.current = { pool, invite: created };
      const page = `${window.location.origin}${withBase('/onboarding/')}`;
      setInvite({
        s: 'open',
        link: inviteLink(created.code, page),
        known: new Set(devices.map((d) => d.id)),
      });
    } catch {
      setInvite({ s: 'error' });
    }
  }

  async function share(link: string) {
    try {
      await navigator.share({ title: t('invite.shareTitle'), url: link });
    } catch {
      // Dismissed, or unsupported: the link is on screen to copy.
    }
  }

  async function beginLan() {
    try {
      const pairing = await startHostPairing(core, {
        deviceName: myName,
        onState: (state, error) => store().update(state, error?.code),
      });
      setLan({ s: 'offer', pairing });
    } catch (error) {
      setLan({ s: 'error', key: errorKey(error) });
    }
  }

  async function answer(text: string) {
    if (lan.s !== 'offer') return;
    try {
      const connected = await lan.pairing.complete(text);
      store().attach(connected.session);
      setLan({ s: 'connecting', checkCode: connected.checkCode });
      await connected.ready;
      // Keep the check code up so people can compare both screens at their own pace.
      setLan({ s: 'connected', checkCode: connected.checkCode });
    } catch (error) {
      setLan({ s: 'error', key: errorKey(error) });
    }
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  return (
    <Card
      title={t('devices')}
      icon={<MonitorSmartphone aria-hidden="true" className="size-5" />}
      action={<SyncStatus />}
    >
      <div className="flex flex-col gap-4">
        <p className="text-muted">{t('intro')}</p>
        <ul className="flex flex-col gap-1">
          {devices
            .filter((d) => !d.revoked)
            .map((d) => (
              <li key={d.id} className="font-medium">
                {d.name}
                {d.id === household?.deviceId && (
                  <span className="text-muted"> · {t('thisDevice')}</span>
                )}
              </li>
            ))}
        </ul>

        <Switch
          label={t('online.label')}
          hint={t('online.hint')}
          checked={relayOn}
          onChange={(on) => void setRelaySync(core.db, on)}
        />

        {(invite.s === 'idle' || invite.s === 'creating') && (
          <Button
            className="self-start"
            disabled={invite.s === 'creating'}
            onClick={() => void createInvite()}
          >
            {t('invite.button')}
          </Button>
        )}

        {invite.s === 'open' && (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-4">
            <p className="font-semibold">{t('invite.title')}</p>
            <p className="text-sm">{t('invite.hint')}</p>
            <QrCode
              frames={[invite.link]}
              label={t('invite.qrLabel')}
              textLabel={t('invite.link')}
              copyLabel={t('invite.copy')}
            />
            {canShare && (
              <Button
                variant="secondary"
                className="self-start"
                onClick={() => void share(invite.link)}
              >
                <Share2 aria-hidden="true" className="size-5" />
                {t('invite.share')}
              </Button>
            )}
            <p role="status" className="font-medium">
              {t('invite.waiting')}
            </p>
            <Button
              variant="ghost"
              className="self-start"
              onClick={() => {
                closeInvite(true);
                setInvite({ s: 'idle' });
              }}
            >
              {t('cancel')}
            </Button>
          </div>
        )}

        {invite.s === 'joined' && (
          <div className="flex flex-col gap-3 rounded-2xl bg-success-soft p-4">
            <p role="status" className="flex items-center gap-2 font-semibold text-success">
              <CheckCircle2 aria-hidden="true" className="size-5" />
              {t('invite.joined', { name: invite.name })}
            </p>
            <Button className="self-start" onClick={() => setInvite({ s: 'idle' })}>
              {t('done')}
            </Button>
          </div>
        )}

        {invite.s === 'error' && (
          <div className="flex flex-col gap-2">
            <p role="alert" className="font-medium text-danger">
              {t('invite.failed')}
            </p>
            <Button
              variant="secondary"
              className="self-start"
              onClick={() => setInvite({ s: 'idle' })}
            >
              {t('cancel')}
            </Button>
          </div>
        )}

        <details
          className="rounded-2xl border border-line p-4"
          open={lan.s !== 'idle' || session !== null}
        >
          <summary className="min-h-6 cursor-pointer font-semibold">{t('lanTitle')}</summary>
          <div className="mt-3 flex flex-col gap-4">
            <p className="text-sm">{t('lanNote')}</p>
            {lan.s === 'idle' && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => void beginLan()}>
                  {t('connect')}
                </Button>
                {session && (
                  <Button variant="secondary" onClick={() => store().disconnect()}>
                    {t('disconnect')}
                  </Button>
                )}
              </div>
            )}

            {lan.s === 'offer' && (
              <div className="flex flex-col gap-4">
                <p className="font-medium">{t('hostStep1')}</p>
                <QrCode frames={lan.pairing.frames} />
                <p className="font-medium">{t('hostStep2')}</p>
                <CodeInput onCode={(text) => void answer(text)} />
                <Button
                  variant="ghost"
                  className="self-start"
                  onClick={() => {
                    lan.pairing.cancel();
                    setLan({ s: 'idle' });
                  }}
                >
                  {t('cancel')}
                </Button>
              </div>
            )}

            {(lan.s === 'connecting' || lan.s === 'connected') && (
              <div className="flex flex-col gap-2">
                <p className="text-lg font-semibold">{t('checkCode', { code: lan.checkCode })}</p>
                {lan.s === 'connected' && (
                  <>
                    <p>{t('connected')}</p>
                    <Button className="self-start" onClick={() => setLan({ s: 'idle' })}>
                      {t('done')}
                    </Button>
                  </>
                )}
              </div>
            )}

            {lan.s === 'error' && (
              <div className="flex flex-col gap-2">
                <p role="alert" className="font-medium text-danger">
                  {t(`errors.${lan.key}`)}
                </p>
                <Button
                  variant="secondary"
                  className="self-start"
                  onClick={() => setLan({ s: 'idle' })}
                >
                  {t('cancel')}
                </Button>
              </div>
            )}
          </div>
        </details>
      </div>
    </Card>
  );
}
