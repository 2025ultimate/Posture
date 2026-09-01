// Small stroke icons for the tab navigation. Kept as one module so the
// nav stays dependency-free and theme-colored via currentColor.

interface IconProps {
  size?: number;
}

export function IconToday({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 11.5 12 4l8 7.5M6 10.5V20h4.5v-5h3v5H18v-9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCheck({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 11.5v4M12 15.5l-2.5 3M12 15.5l2.5 3M9.5 13l2.5-.8 2.5.8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconDesk({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M9 20h6M12 16v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="8.2" r="1.7" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8.8 13.4c.6-1.6 1.8-2.5 3.2-2.5s2.6.9 3.2 2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconProgress({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 20V4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 20h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 16v-4M12 16V8M16 16v-6M20 16V6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconLearn({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 6.5C10.5 5 8.5 4.5 6 4.5c-1 0-2 .1-3 .4v13.6c1-.3 2-.4 3-.4 2.5 0 4.5.5 6 2 1.5-1.5 3.5-2 6-2 1 0 2 .1 3 .4V4.9c-1-.3-2-.4-3-.4-2.5 0-4.5.5-6 2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 6.5V20" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function IconFlame({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3c.6 3-0.8 4.6-2.2 6C8.3 10.5 7 12.1 7 14.5A5 5 0 0 0 12 19.5a5 5 0 0 0 5-5c0-1.6-.6-2.9-1.4-4-.4 1-1 1.7-1.8 2.1.4-2.9-.5-6.6-1.8-9.6z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPlay({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <polygon points="4,2 16,9 4,16" fill="currentColor" />
    </svg>
  );
}

export function IconPause({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <rect x="4" y="2" width="3.5" height="14" rx="1" fill="currentColor" />
      <rect x="10.5" y="2" width="3.5" height="14" rx="1" fill="currentColor" />
    </svg>
  );
}

export function IconFlip({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9a8 8 0 0 1 14-3.5M20 15a8 8 0 0 1-14 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M18 2v4h-4M6 22v-4h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
