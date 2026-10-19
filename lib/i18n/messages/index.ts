import type { Locale } from '../config';
import en from './en.json';
import nl from './nl.json';

export type Messages = typeof en;

// Both catalogues are bundled so the app is fully localised offline.
export const catalogues: Record<Locale, Messages> = { en, nl };
