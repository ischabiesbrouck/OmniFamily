import type { IntakeRequest } from './schema';

/** A language-model backend that turns an (anonymised) snippet into a ParsedFamilyEntry. */
export interface IntakeProvider {
  parse(request: IntakeRequest, signal: AbortSignal): Promise<unknown>;
}

/**
 * v1 ships WITHOUT a provider. Choosing a paid LLM service and supplying its API key is the
 * owner's decision (SPEC §10.9 stop condition a), so `/api/intake` answers 503 until a
 * provider is added here. Everything else in the app works without it (D2).
 */
export function getIntakeProvider(): IntakeProvider | null {
  return null;
}
