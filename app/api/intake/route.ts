import { handleIntake } from '@/lib/intake/handler';
import { getIntakeProvider } from '@/lib/intake/provider';

// The ONLY server code in v1 (SPEC D1/D2): a stateless proxy. No storage, no logging.
export const dynamic = 'force-dynamic';

export function POST(request: Request): Promise<Response> {
  return handleIntake(request, getIntakeProvider());
}
