import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '@/lib/a11y/contrast';
import { MEMBER_COLORS } from '@/lib/members/colors';

const AAA = 7;

describe('colour contrast (WCAG 2.2 AAA, SC 1.4.6)', () => {
  it('computes known ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  it.each(MEMBER_COLORS)('white initials on member colour $id reach 7:1', ({ hex }) => {
    expect(contrastRatio('#ffffff', hex)).toBeGreaterThanOrEqual(AAA);
  });

  it('every text token in globals.css reaches 7:1 on the surface', () => {
    const css = readFileSync('app/globals.css', 'utf8');
    const token = (name: string) => {
      const match = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css);
      if (!match?.[1]) throw new Error(`token ${name} missing`);
      return match[1];
    };
    for (const name of ['ink', 'muted', 'danger', 'focus']) {
      expect(contrastRatio(token(name), token('surface')), name).toBeGreaterThanOrEqual(AAA);
    }
  });
});
