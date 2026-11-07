"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "./Icon";

export type PopupEvent = {
  id: string;
  title: string;
  whenLabel: string;
  priceLabel: string;
  address: string | null;
  imagePath: string | null;
};

// The "something's on" pop-up for clients. Shows once per event per device:
// closing it (or booking) stores the id so it doesn't nag them again.
const KEY = "ppc-events-seen";

function seenIds(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function EventPopup({ events }: { events: PopupEvent[] }) {
  const [event, setEvent] = useState<PopupEvent | null>(null);

  useEffect(() => {
    const seen = seenIds();
    const next = events.find((e) => !seen.includes(e.id));
    if (next) {
      // Let the page paint first so it arrives as a pop-up, not a flash.
      const t = setTimeout(() => setEvent(next), 400);
      return () => clearTimeout(t);
    }
  }, [events]);

  function dismiss() {
    if (!event) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify([...seenIds(), event.id].slice(-30)));
    } catch {
      // private mode - it'll just show again next time
    }
    setEvent(null);
  }

  if (!event) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end p-4 sm:place-items-center"
      role="dialog"
      aria-modal="true"
      onClick={dismiss}
    >
      <div className="absolute inset-0 bg-charcoal/50" />
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {event.imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.imagePath} alt="" className="h-36 w-full object-cover" />
        ) : (
          <div className="grid h-24 w-full place-items-center bg-gradient-to-br from-brand to-brand-dark text-white">
            <Icon name="sparkles" className="h-8 w-8" />
          </div>
        )}

        <div className="space-y-2 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-brand">New event</p>
          <h2 className="text-lg font-extrabold">{event.title}</h2>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Icon name="calendar" className="h-4 w-4 shrink-0 text-brand" />
            {event.whenLabel}
          </p>
          {event.address && (
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Icon name="mapPin" className="h-4 w-4 shrink-0 text-brand" />
              {event.address}
            </p>
          )}
          <p className="text-sm font-bold">{event.priceLabel}</p>

          <div className="flex gap-2 pt-2">
            <Link href="/client/events" onClick={dismiss} className="btn-primary text-sm">
              Book a place
            </Link>
            <button onClick={dismiss} className="btn-ghost text-sm">
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
