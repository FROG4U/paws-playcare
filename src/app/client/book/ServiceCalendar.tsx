"use client";

import { useMemo, useState } from "react";
import type { BookServiceOption } from "./BookingForm";

const WD_HEADERS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_SHORT: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };

// One colour per service, in the order services are configured. Explicit hex
// (applied via inline style) so it renders identically in every browser and
// never depends on a Tailwind colour utility being present in the CSS bundle.
export const SERVICE_PALETTE = [
  { soft: "#e2f1fb", solid: "#2ea6d8", softText: "#1c6f95" }, // brand sky-blue
  { soft: "#fbeede", solid: "#e0912e", softText: "#a5620d" }, // amber
  { soft: "#e2f4e9", solid: "#16a34a", softText: "#0e7a36" }, // green
];

function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function isoWeekday(y: number, m: number, d: number): number {
  const wd = new Date(Date.UTC(y, m, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}
function daysLabel(days: number[]): string {
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.length === 0) return "";
  return sorted.length === 1
    ? DAY_SHORT[sorted[0]]
    : `${DAY_SHORT[sorted[0]]}–${DAY_SHORT[sorted[sorted.length - 1]]}`;
}

export function ServiceCalendar({
  services,
  selected,
  onToggle,
  todayIso,
  bankHolidays,
}: {
  services: BookServiceOption[];
  selected: string[];
  onToggle: (iso: string) => void;
  todayIso: string;
  bankHolidays: Set<string>;
}) {
  // Which service runs on each weekday (first configured wins on any overlap).
  const wdMap = useMemo(() => {
    const map: Record<number, { svc: BookServiceOption; idx: number }> = {};
    services.forEach((s, i) => {
      for (const d of s.days) if (!map[d]) map[d] = { svc: s, idx: i };
    });
    return map;
  }, [services]);

  const today = useMemo(() => new Date(todayIso + "T00:00:00.000Z"), [todayIso]);
  const [view, setView] = useState({ y: today.getUTCFullYear(), m: today.getUTCMonth() });

  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const blanks = isoWeekday(view.y, view.m, 1) - 1; // Monday-first leading gap
  const selSet = useMemo(() => new Set(selected), [selected]);

  const canPrev =
    view.y > today.getUTCFullYear() ||
    (view.y === today.getUTCFullYear() && view.m > today.getUTCMonth());

  const prev = () => setView((v) => (v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 }));
  const next = () => setView((v) => (v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 }));

  const cells: (number | null)[] = [
    ...Array(blanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="rounded-2xl border border-border p-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <button
          type="button"
          onClick={prev}
          disabled={!canPrev}
          aria-label="Previous month"
          className="grid h-8 w-8 place-items-center rounded-lg text-lg text-muted transition hover:bg-brand-soft disabled:opacity-25"
        >
          ‹
        </button>
        <p className="font-bold">
          {MONTHS[view.m]} {view.y}
        </p>
        <button
          type="button"
          onClick={next}
          aria-label="Next month"
          className="grid h-8 w-8 place-items-center rounded-lg text-lg text-muted transition hover:bg-brand-soft"
        >
          ›
        </button>
      </div>

      <div
        className="gap-1 px-0.5 pb-1 text-center text-[11px] font-bold"
        style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {WD_HEADERS.map((h, i) => (
          <div key={h} className={i >= 5 ? "text-muted/40" : "text-muted"}>
            {h}
          </div>
        ))}
      </div>

      <div
        className="gap-1"
        style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
      >
        {cells.map((d, i) => {
          if (d === null) return <div key={`b${i}`} />;
          const dIso = isoOf(view.y, view.m, d);
          const wd = isoWeekday(view.y, view.m, d);
          const past = dIso < todayIso;
          const weekend = wd > 5;
          const bh = bankHolidays.has(dIso);
          const entry = wdMap[wd];
          const blocked = past || weekend || bh || !entry;

          if (blocked) {
            const title = weekend
              ? "Weekend — closed"
              : bh
                ? "Bank holiday — closed"
                : past
                  ? "Past date"
                  : "Not available";
            return (
              <div
                key={dIso}
                title={title}
                className={`grid h-10 place-items-center rounded-lg text-sm text-muted/40 ${
                  weekend || bh ? "bg-background" : ""
                }`}
              >
                {d}
              </div>
            );
          }

          const pal = SERVICE_PALETTE[entry.idx % SERVICE_PALETTE.length];
          const sel = selSet.has(dIso);
          return (
            <button
              key={dIso}
              type="button"
              onClick={() => onToggle(dIso)}
              aria-pressed={sel}
              title={entry.svc.name}
              className={`grid h-10 place-items-center rounded-lg text-sm font-semibold transition ${
                sel ? "shadow-sm" : "hover:opacity-75"
              }`}
              style={{
                backgroundColor: sel ? pal.solid : pal.soft,
                color: sel ? "#ffffff" : pal.softText,
              }}
            >
              {d}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1 text-xs text-muted">
        {services.map((s, i) => (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SERVICE_PALETTE[i % SERVICE_PALETTE.length].solid }}
            />
            {s.name}{" "}
            <span className="text-muted/60">({daysLabel(s.days)})</span>
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-border bg-background" />
          Weekends closed
        </span>
      </div>
    </div>
  );
}
