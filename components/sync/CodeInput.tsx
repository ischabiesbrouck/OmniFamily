'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FrameCollector, framesToText } from '@/lib/sync/qrPayload';

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
type BarcodeDetectorCtor = new (options: { formats: string[] }) => BarcodeDetectorLike;

/** Camera scan (BarcodeDetector, else jsQR) with a paste fallback; reassembles multi-frame codes. */
export function CodeInput({
  onCode,
  disabled = false,
}: {
  onCode: (text: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('sync');
  const [text, setText] = useState('');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<{ received: number; count: number } | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | undefined;
    let frame = 0;
    let stopped = false;
    const collector = new FrameCollector();
    const seen = new Set<string>();

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        const el = video.current;
        if (!el || stopped) return;
        el.srcObject = stream;
        await el.play();
        const Detector = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
        const detector = Detector ? new Detector({ formats: ['qr_code'] }) : undefined;
        const jsQR = detector ? undefined : (await import('jsqr')).default;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const tick = async () => {
          if (stopped) return;
          const values: string[] = [];
          if (detector) {
            values.push(...(await detector.detect(el)).map((r) => r.rawValue));
          } else if (jsQR && ctx && el.videoWidth > 0) {
            canvas.width = el.videoWidth;
            canvas.height = el.videoHeight;
            ctx.drawImage(el, 0, 0);
            const found = jsQR(
              ctx.getImageData(0, 0, canvas.width, canvas.height).data,
              canvas.width,
              canvas.height,
            );
            if (found) values.push(found.data);
          }
          for (const value of values) {
            if (seen.has(value)) continue;
            seen.add(value);
            try {
              setProgress(collector.add(value));
            } catch {
              continue; // not one of our codes
            }
            if (collector.complete) {
              const frames = [...seen].filter((v) => v.startsWith('OF1/'));
              setScanning(false);
              onCode(framesToText(frames));
              return;
            }
          }
          frame = requestAnimationFrame(() => void tick());
        };
        void tick();
      } catch {
        setCameraError(true);
        setScanning(false);
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [scanning, onCode]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (text.trim()) onCode(text.trim());
  }

  const canScan = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  return (
    <div className="flex flex-col gap-3">
      {canScan && !cameraError ? (
        <Button
          variant="secondary"
          className="self-start"
          disabled={disabled}
          onClick={() => setScanning((s) => !s)}
        >
          {scanning ? t('stopScan') : t('scan')}
        </Button>
      ) : (
        <p>{t('noCamera')}</p>
      )}
      {scanning && (
        <div className="flex flex-col gap-2">
          <video
            ref={video}
            muted
            playsInline
            className="aspect-square w-full max-w-72 rounded-lg bg-black object-cover"
          />
          <p aria-live="polite">
            {progress && progress.count > 1 ? t('scanning', progress) : t('scanningOne')}
          </p>
        </div>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 font-medium">
          {t('pasteLabel')}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="rounded-lg border border-line-strong p-2 font-mono text-xs"
          />
        </label>
        <Button type="submit" className="self-start" disabled={disabled || text.trim() === ''}>
          {t('useCode')}
        </Button>
      </form>
    </div>
  );
}
