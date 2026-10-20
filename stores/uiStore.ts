import { create } from 'zustand';
import type { EventDraft } from '@/lib/db/repositories/events';
import type { Occurrence } from '@/lib/recurrence/expand';
import type { FloatingDate } from '@/lib/time/zoned';

export type EditorState =
  | { mode: 'new'; date: FloatingDate; draft?: EventDraft }
  | { mode: 'edit'; occurrence: Occurrence }
  | null;

export type QuickSheet = 'add' | 'task' | 'grocery' | 'import' | null;

export interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

/** Transient UI state shared across pages (never persisted). */
interface UiState {
  editor: EditorState;
  sheet: QuickSheet;
  toasts: Toast[];
  openEditor: (editor: EditorState) => void;
  openSheet: (sheet: QuickSheet) => void;
  toast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

let nextToast = 1;
const TOAST_MS = 4_000;

export const useUiStore = create<UiState>()((set, get) => ({
  editor: null,
  sheet: null,
  toasts: [],
  openEditor: (editor) => set({ editor, sheet: null }),
  openSheet: (sheet) => set({ sheet }),
  toast: (message, tone = 'success') => {
    const id = nextToast++;
    set({ toasts: [...get().toasts.slice(-2), { id, message, tone }] });
    setTimeout(() => get().dismissToast(id), TOAST_MS);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
