'use client';

import { Suspense } from 'react';
import { CalendarView } from '@/components/calendar/CalendarView';

export default function CalendarPage() {
  // useSearchParams needs a Suspense boundary for static prerendering.
  return (
    <Suspense>
      <CalendarView />
    </Suspense>
  );
}
