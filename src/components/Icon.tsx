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
  calendarCheck: (
    <>
      <rect x="3" y="4.5" width="18" height="17" rx="2" />
      <path d="M8 3v3M16 3v3M3 9.5h18M9 15l2 2 4-4" />
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
  userPlus: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <path d="M18 8v6M15 11h6" />
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
  pound: (
    <>
      <path d="M9 20V9.5A3.5 3.5 0 0 1 15.5 7.8" />
      <path d="M7 13.5h6.5M7 20h10.5" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="8.5" cy="7" rx="5.5" ry="3" />
      <path d="M3 7v4c0 1.7 2.5 3 5.5 3" />
      <ellipse cx="15.5" cy="14" rx="5.5" ry="3" />
      <path d="M10 14v3c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  hourglass: (
    <>
      <path d="M6 3h12v3l-6 6 6 6v3H6v-3l6-6-6-6V3Z" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  pencil: (
    <>
      <path d="M4 20h4l10.5-10.5a1.5 1.5 0 0 0 0-2.1l-1.9-1.9a1.5 1.5 0 0 0-2.1 0L4 16v4Z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
    </>
  ),
  chevronRight: <path d="M9 6l6 6-6 6" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  alert: (
    <>
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9.5v4.5M12 17.5h.01" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </>
  ),
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M8 5l11 7-11 7V5Z" />,
  phone: (
    <path d="M4 5c0 8.3 6.7 15 15 15l1.6-3.7-4.5-2-2 2c-2.5-1.3-4.6-3.4-5.9-5.9l2-2-2-4.5L4 5Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5 12 13l8.5-6.5" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  gift: (
    <>
      <rect x="3.5" y="8" width="17" height="4" rx="1" />
      <path d="M5 12v9h14v-9M12 8v13" />
      <path d="M12 8C9.5 8 8 6.8 8.6 5.4 9.1 4.2 11 4.8 12 8c1-3.2 2.9-3.8 3.4-2.6C16 6.8 14.5 8 12 8Z" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6L12 3Z" />
      <path d="M18.5 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </>
  ),
  logout: (
    <>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5M9 13h6M9 17h5" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M4 17l5-5 4 4 3-3 4 4" />
    </>
  ),
  car: (
    <>
      <path d="M5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11" />
      <path d="M3 11h18v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5Z" />
      <path d="M6.5 14h.01M17.5 14h.01" />
    </>
  ),
  shield: (
    <path d="M12 3l7 3v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3Z" />
  ),
  shieldCheck: (
    <>
      <path d="M12 3l7 3v5c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6l7-3Z" />
      <path d="M9 11.5l2 2 4-4.5" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
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
      width="20"
      height="20"
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
