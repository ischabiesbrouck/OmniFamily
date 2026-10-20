'use client';

import qrcode from 'qrcode-generator';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { framesToText } from '@/lib/sync/qrPayload';

const FRAME_MS = 700;

function matrixPath(text: string): { size: number; d: string } {
  const qr = qrcode(0, 'M');
  qr.addData(text, 'Alphanumeric');
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r += 1)
    for (let c = 0; c < n; c += 1) if (qr.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
  return { size: n + 8, d };
}

/** Shows one static QR, or cycles through frames as an animated QR (SPEC D3). */
export function QrCode({ frames }: { frames: readonly string[] }) {
  const t = useTranslations('sync');
  const [index, setIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const paths = useMemo(() => frames.map(matrixPath), [frames]);
  const text = framesToText(frames);

  useEffect(() => {
    if (frames.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % frames.length), FRAME_MS);
    return () => window.clearInterval(id);
  }, [frames.length]);

  const current = paths[index % paths.length];
  return (
    <div className="flex flex-col gap-3">
      {current && (
        <svg
          role="img"
          aria-label={t('qrLabel')}
          viewBox={`0 0 ${current.size} ${current.size}`}
          className="aspect-square w-full max-w-72 bg-white"
          shapeRendering="crispEdges"
        >
          <path d={current.d} fill="#000000" />
        </svg>
      )}
      {frames.length > 1 && (
        <p aria-live="off">
          {t('frames', { index: (index % frames.length) + 1, count: frames.length })}
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        {t('textCode')}
        <textarea
          readOnly
          value={text}
          rows={3}
          className="rounded-lg border border-ink/40 p-2 font-mono text-xs"
        />
      </label>
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => setCopied(true));
        }}
      >
        {copied ? t('copied') : t('copy')}
      </Button>
    </div>
  );
}
