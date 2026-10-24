import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Locale } from '@/lib/i18n/config';
import { DEVICE_STORE_KEY } from '@/lib/theme';

/** Per-device preferences (SPEC §2). Never synced; cleared with "Delete everything". */
export type ThemePreference = 'system' | 'light' | 'dark';

interface DeviceState {
  activeMemberId: string | null;
  locale: Locale | null;
  theme: ThemePreference;
  /** The "New here?" card on Today was opened or dismissed. */
  guideSeen: boolean;
  setActiveMember: (id: string | null) => void;
  setLocale: (locale: Locale | null) => void;
  setTheme: (theme: ThemePreference) => void;
  setGuideSeen: () => void;
}

export { DEVICE_STORE_KEY };

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      activeMemberId: null,
      locale: null,
      theme: 'system',
      guideSeen: false,
      setActiveMember: (activeMemberId) => set({ activeMemberId }),
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      setGuideSeen: () => set({ guideSeen: true }),
    }),
    {
      name: DEVICE_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ activeMemberId, locale, theme, guideSeen }) => ({
        activeMemberId,
        locale,
        theme,
        guideSeen,
      }),
    },
  ),
);
