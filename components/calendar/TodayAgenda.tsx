'use client';

import { useTimeZone } from 'next-intl';
import { useMemo, useState } from 'react';
import { windowFor } from '@/lib/calendar/grid';
import { useMembers } from '@/lib/db/repositories/hooks';
import { todayIn } from '@/lib/time/zoned';
import { useDeviceStore } from '@/stores/deviceStore';
import { DayAgenda } from './DayAgenda';
import { EventDialog, type EditorState } from './EventDialog';
import { useOccurrences } from './useOccurrences';

export function TodayAgenda() {
  const zone = useTimeZone() ?? 'UTC';
  const members = useMembers() ?? [];
  const activeMemberId = useDeviceStore((s) => s.activeMemberId);
  const [editor, setEditor] = useState<EditorState>(null);
  const today = todayIn(zone);
  const window = useMemo(() => windowFor('day', today, zone), [today, zone]);
  const occurrences = useOccurrences(window, zone, activeMemberId);

  if (!occurrences) return null;
  return (
    <>
      <DayAgenda
        occurrences={occurrences}
        members={members}
        onOpen={(occurrence) => setEditor({ mode: 'edit', occurrence })}
      />
      <EventDialog
        state={editor}
        members={members}
        timeZone={zone}
        activeMemberId={activeMemberId}
        onClose={() => setEditor(null)}
      />
    </>
  );
}
