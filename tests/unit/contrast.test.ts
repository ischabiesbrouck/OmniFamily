import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/lib/a11y/contrast';
import { MEMBER_COLORS } from '@/lib/members/colors';

const AAA = 7;
const css = readFileSync('app/globals.css', 'utf8');

/** [light, dark] values of a `--name: light-dark(#light, #dark);` token. */
function token(name: string): [string, string] {
  const match = new RegExp(
    `--${name}:\\s*light-dark\\((#[0-9a-f]{6}),\\s*(#[0-9a-f]{6})\\)`,
    'i',
  ).exec(css);
  if (!match?.[1] || !match[2]) throw new Error(`token ${name} missing`);
  return [match[1], match[2]];
}

/** Text token → backgrounds it is used on. */
const PAIRS: Record<string, string[]> = {
  ink: ['canvas', 'surface', 'surface-2', 'accent-soft'],
  muted: ['canvas', 'surface', 'surface-2'],
  accent: ['canvas', 'surface', 'surface-2'],
  'on-accent': ['accent'],
  'accent-soft-ink': ['accent-soft'],
  danger: ['canvas', 'surface', 'danger-soft'],
  'on-danger': ['danger'],
  success: ['surface', 'success-soft'],
  warning: ['surface', 'warning-soft'],
};

describe('colour contrast (WCAG 2.2 AAA, SC 1.4.6)', () => {
  it('computes known ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it.each(MEMBER_COLORS)('white initials on member colour $id reach 7:1', ({ hex }) => {
    expect(contrastRatio('#ffffff', hex)).toBeGreaterThanOrEqual(AAA);
  });

  for (const [theme, i] of [
    ['light', 0],
    ['dark', 1],
  ] as const) {
    it(`every text token reaches 7:1 on its backgrounds (${theme})`, () => {
      for (const [text, backgrounds] of Object.entries(PAIRS)) {
        for (const bg of backgrounds) {
          const ratio = contrastRatio(token(text)[i], token(bg)[i]);
          expect(ratio, `${text} on ${bg} (${theme}): ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(
            AAA,
          );
        }
      }
    });
  }

  it('input and divider borders reach 3:1 for non-text contrast (SC 1.4.11)', () => {
    for (const i of [0, 1]) {
      for (const bg of ['canvas', 'surface']) {
        expect(contrastRatio(token('line-strong')[i]!, token(bg)[i]!)).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
