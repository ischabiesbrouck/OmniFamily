/** Invite codes are 22 Base64url characters (128 bits); links carry them in the fragment. */
export function parseInviteCode(text: string): string | null {
  const match = /(?:#join=|^\s*)([A-Za-z0-9_-]{22})\s*$/.exec(text.trim());
  return match?.[1] ?? null;
}

export function inviteLink(code: string, pageUrl: string): string {
  return `${pageUrl}#join=${code}`;
}
