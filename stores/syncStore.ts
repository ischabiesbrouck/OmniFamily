import { create } from 'zustand';
import type { SessionState, SyncSession } from '@/lib/sync/syncEngine';

/**
 * The live sync session outlives page navigation (client-side routing keeps this module).
 * Not persisted: a reload closes the DataChannel, and reconnecting needs a new QR exchange.
 */
interface SyncState {
  session: SyncSession | null;
  state: SessionState | 'idle';
  peerName: string | null;
  errorCode: string | null;
  attach: (session: SyncSession) => void;
  update: (state: SessionState, errorCode?: string) => void;
  disconnect: () => void;
}

export const useSyncStore = create<SyncState>()((set, get) => ({
  session: null,
  state: 'idle',
  peerName: null,
  errorCode: null,
  attach: (session) => {
    get().session?.close();
    set({
      session,
      state: session.state,
      peerName: session.peer?.deviceName ?? null,
      errorCode: null,
    });
  },
  update: (state, errorCode) =>
    set({ state, peerName: get().session?.peer?.deviceName ?? null, errorCode: errorCode ?? null }),
  disconnect: () => {
    get().session?.close();
    set({ session: null, state: 'idle', peerName: null, errorCode: null });
  },
}));
