/** The app mark (same drawing as the PWA icon), decorative. */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id="brand-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c6cf6" />
          <stop offset="1" stopColor="#1fa896" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill="url(#brand-mark)" />
      <rect
        x="112"
        y="136"
        width="288"
        height="256"
        rx="44"
        fill="none"
        stroke="#ffffff"
        strokeWidth="28"
      />
      <path d="M112 212h288" stroke="#ffffff" strokeWidth="28" />
      <path d="M184 104v64M328 104v64" stroke="#ffffff" strokeWidth="28" strokeLinecap="round" />
      <circle cx="196" cy="300" r="26" fill="#ffffff" />
      <circle cx="256" cy="300" r="26" fill="#ffd9c4" />
      <circle cx="316" cy="300" r="26" fill="#c8f3ec" />
    </svg>
  );
}
