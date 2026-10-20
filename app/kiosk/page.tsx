'use client';

import dynamic from 'next/dynamic';
import { KioskView } from '@/components/kiosk/KioskView';

// The wall display keeps receiving changes over the internet too (D-10.1, flag as D-6.9).
const RelaySyncRunner =
  process.env.NEXT_PUBLIC_FEATURE_SYNC === 'true'
    ? dynamic(() => import('@/components/sync/RelaySyncRunner'), { ssr: false })
    : null;

export default function KioskPage() {
  return (
    <>
      <KioskView />
      {RelaySyncRunner && <RelaySyncRunner />}
    </>
  );
}
