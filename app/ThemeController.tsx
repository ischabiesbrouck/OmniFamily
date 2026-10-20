'use client';

import { useEffect } from 'react';
import { useDeviceStore } from '@/stores/deviceStore';

/** Keeps <html data-theme> in step with the saved preference ("system" removes it). */
export function ThemeController() {
  const theme = useDeviceStore((s) => s.theme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light' || theme === 'dark') root.dataset.theme = theme;
    else delete root.dataset.theme;
  }, [theme]);
  return null;
}
