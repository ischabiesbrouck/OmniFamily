import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Locale } from '@/lib/i18n/config';

/** Per-device preferences (SPEC §2). Never synced; cleared with "Delete everything". */
interface DeviceState {
  activeMemberId: string | null;
  locale: Locale | null;
  setActiveMember: (id: string | null) => void;
  setLocale: (locale: Locale | null) => void;
}

export const DEVICE_STORE_KEY = 'omnifamily-device';

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set) => ({
      activeMemberId: null,
      locale: null,
      setActiveMember: (activeMemberId) => set({ activeMemberId }),
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: DEVICE_STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ activeMemberId, locale }) => ({ activeMemberId, locale }),
    },
  ),
);
