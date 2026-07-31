// Keyline (thin-stroke) icon set — 24×24, inherits colour via currentColor.
import type { ReactNode } from "react";

const PATHS: Record<string, ReactNode> = {
  home: (
    <>
      <path d="M3 10l9-7 9 7" />
      <path d="M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9" />
    </>
  ),
  inbox: (
    <>
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.5 5h13a1 1 0 0 1 .9.6L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l2.6-6.4A1 1 0 0 1 5.5 5Z" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4.5" width="18" height="17" rx="2" />
      <path d="M8 3v3M16 3v3M3 9.5h18" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5" />
    </>
  ),
  clipboard: (
    <>
      <rect x="8" y="3" width="8" height="4" rx="1" />
      <path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" />
      <path d="M8.5 12h7M8.5 16h7" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 5.2a3.5 3.5 0 0 1 0 6.6" />
      <path d="M18 14.6a6 6 0 0 1 3 5.4" />
    </>
  ),
  footprints: (
    <>
      <ellipse cx="7" cy="13.5" rx="2.2" ry="3.2" />
      <ellipse cx="17" cy="10" rx="2.2" ry="3.2" />
      <path d="M4.8 18.5c0 1.6 4.4 1.6 4.4 0" />
      <path d="M14.8 15c0 1.6 4.4 1.6 4.4 0" />
    </>
  ),
  paw: (
    <>
      <ellipse cx="8.5" cy="9" rx="1.8" ry="2.3" />
      <ellipse cx="15.5" cy="9" rx="1.8" ry="2.3" />
      <ellipse cx="5.4" cy="13.6" rx="1.6" ry="2" />
      <ellipse cx="18.6" cy="13.6" rx="1.6" ry="2" />
      <path d="M12 12.5c-2.6 0-4.5 2-4.5 4.2 0 1.9 1.8 2.8 4.5 2.8s4.5-.9 4.5-2.8c0-2.2-1.9-4.2-4.5-4.2Z" />
    </>
  ),
  tag: (
    <>
      <path d="M11 3H4a1 1 0 0 0-1 1v7a1 1 0 0 0 .3.7l9 9a1 1 0 0 0 1.4 0l7-7a1 1 0 0 0 0-1.4l-9-9A1 1 0 0 0 11 3Z" />
      <circle cx="7.5" cy="7.5" r="1.2" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3v18l2-1.2 2 1.2 2-1.2 2 1.2 2-1.2 2 1.2V3l-2 1.2-2-1.2-2 1.2-2-1.2-2 1.2Z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2" />
      <path d="M21 12h-5a2 2 0 0 0 0 4h5a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1Z" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <path d="M2.5 10h19M6 15h4" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
};

export function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.paw}
    </svg>
  );
}
