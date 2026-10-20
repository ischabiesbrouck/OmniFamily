/** The app mark (same drawing as the PWA icon), decorative. */
export function BrandMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" aria-hidden="true" className={`shrink-0 ${className}`}>
      <rect width="512" height="512" rx="112" fill="#3730a3" />
      <rect
        x="112"
        y="136"
        width="288"
        height="256"
        rx="36"
        fill="none"
        stroke="#ffffff"
        strokeWidth="28"
      />
      <path d="M112 212h288" stroke="#ffffff" strokeWidth="28" />
      <path d="M184 104v64M328 104v64" stroke="#ffffff" strokeWidth="28" strokeLinecap="round" />
      <circle cx="196" cy="300" r="26" fill="#93c5fd" />
      <circle cx="256" cy="300" r="26" fill="#fca5a5" />
      <circle cx="316" cy="300" r="26" fill="#86efac" />
    </svg>
  );
}
