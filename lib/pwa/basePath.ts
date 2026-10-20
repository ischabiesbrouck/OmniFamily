/** URL prefix of the GitHub Pages build (`/OmniFamily`); empty everywhere else (D-8.2). */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** For URLs Next.js does not prefix itself (metadata, manifest, window.location). */
export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
