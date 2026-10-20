import { withBase } from '@/lib/pwa/basePath';

/** Longest side photos are scaled to before OCR: plenty for text, much faster than 12 MP. */
const MAX_SIDE = 2_000;

async function downscale(image: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return image;
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1) return image;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob ?? image), 'image/png'));
}

/**
 * On-device OCR (tesseract.js, English + Dutch). Engine and language data are served from
 * this app's own origin (/ocr, see scripts/copy-ocr-assets.mjs) — the photo never leaves
 * the device and no CDN is contacted (D-9.3).
 */
export async function recognizeImage(
  image: Blob,
  locale: string,
  onProgress?: (fraction: number) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const languages = locale.toLowerCase().startsWith('nl') ? ['nld', 'eng'] : ['eng', 'nld'];
  const worker = await createWorker(languages, 1, {
    workerPath: withBase('/ocr/worker.min.js'),
    corePath: withBase('/ocr/core'),
    langPath: withBase('/ocr/lang'),
    workerBlobURL: false,
    gzip: true,
    // The service worker caches the files; tesseract's own IndexedDB cache would outlive
    // "Delete everything".
    cacheMethod: 'none',
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress?.(m.progress);
    },
  });
  try {
    const { data } = await worker.recognize(await downscale(image));
    return data.text;
  } finally {
    await worker.terminate();
  }
}
