// Copies the OCR engine (tesseract.js worker + LSTM WASM cores) and the English/Dutch
// language data into public/ocr, so photo import never contacts a third-party CDN.
// Runs before dev/build; the files are generated (git-ignored) and loaded only on first use.
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const out = 'public/ocr';
const tesseract = dirname(require.resolve('tesseract.js/package.json'));
const core = dirname(
  createRequire(join(tesseract, 'package.json')).resolve('tesseract.js-core/package.json'),
);

const copies = [
  [join(tesseract, 'dist/worker.min.js'), 'worker.min.js'],
  ...[
    'tesseract-core-lstm.wasm.js',
    'tesseract-core-simd-lstm.wasm.js',
    'tesseract-core-relaxedsimd-lstm.wasm.js',
  ].map((f) => [join(core, f), `core/${f}`]),
  ...['eng', 'nld'].map((lang) => [
    require.resolve(`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`),
    `lang/${lang}.traineddata.gz`,
  ]),
];

let bytes = 0;
for (const [from, to] of copies) {
  const target = join(out, to);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(from, target);
  bytes += statSync(target).size;
}
console.log(`OCR assets: ${copies.length} files, ${(bytes / 1024 / 1024).toFixed(1)} MB → ${out}`);
