"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ServiceBadge } from "@/components/ServiceBadge";
import { completeWalk, completeWalks } from "./actions";

export type WalkCard = {
  id: string;
  pets: string; // dog name(s) — shown as the card title
  owner: string; // client/owner name — shown small underneath
  service: string | null;
  colorIndex: number | null;
  dateLabel: string;
  numDogs: number;
  priceLabel: string;
  worker: string | null;
  statusLabel: string;
  bookingId: string | null;
};

export type Week = { key: string; label: string; walks: WalkCard[] };

export function BookingsBoard({ ready, weeks }: { ready: WalkCard[]; weeks: Week[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();

  const allIds = useMemo(
    () => [...ready.map((w) => w.id), ...weeks.flatMap((wk) => wk.walks.map((w) => w.id))],
    [ready, weeks]
  );

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const setMany = (ids: string[], on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      for (const id of ids) (on ? n.add(id) : n.delete(id));
      return n;
    });
  const clear = () => setSelected(new Set());

  const completeSelected = () =>
    start(async () => {
      await completeWalks([...selected]);
      clear();
    });

  const total = ready.length + weeks.reduce((n, wk) => n + wk.walks.length, 0);
  if (total === 0) return null;

  return (
    <>
      {/* Ready to complete */}
      {ready.length > 0 && (
        <Section
          title="Ready to complete"
          icon="footprints"
          walks={ready}
          selected={selected}
          onToggle={toggle}
          onSelectAll={(on) => setMany(ready.map((w) => w.id), on)}
          canComplete
        />
      )}

      {/* Upcoming, week by week — completable too (admin can mark any walk done) */}
      {weeks.map((wk) => (
        <Section
          key={wk.key}
          title={wk.label}
          icon="calendar"
          walks={wk.walks}
          selected={selected}
          onToggle={toggle}
          onSelectAll={(on) => setMany(wk.walks.map((w) => w.id), on)}
          canComplete
        />
      ))}

      {/* Sticky bulk action bar */}
      {selected.size > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-xl">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={clear} disabled={pending} className="btn-ghost text-sm">Clear</button>
            <button onClick={completeSelected} disabled={pending} className="btn-primary">
              {pending ? "Completing…" : `Complete ${selected.size}`}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  icon,
  walks,
  selected,
  onToggle,
  onSelectAll,
  canComplete,
}: {
  title: string;
  icon: string;
  walks: WalkCard[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (on: boolean) => void;
  canComplete?: boolean;
}) {
  const allOn = walks.every((w) => selected.has(w.id));
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name={icon} className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-bold">{title}</h2>
          <span className="badge bg-mist text-muted">{walks.length}</span>
        </div>
        {canComplete && (
          <button onClick={() => onSelectAll(!allOn)} className="text-xs font-semibold text-brand hover:underline">
            {allOn ? "Unselect all" : "Select all"}
          </button>
        )}
      </div>
      <div className="space-y-2">
        {walks.map((w) => (
          <WalkRow key={w.id} w={w} checked={selected.has(w.id)} onToggle={() => onToggle(w.id)} canComplete={canComplete} />
        ))}
      </div>
    </section>
  );
}

function WalkRow({
  w,
  checked,
  onToggle,
  canComplete,
}: {
  w: WalkCard;
  checked: boolean;
  onToggle: () => void;
  canComplete?: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={`card flex flex-wrap items-center gap-3 ${checked && canComplete ? "ring-2 ring-brand/40" : ""}`}>
      {canComplete && (
        <input type="checkbox" checked={checked} onChange={onToggle} className="h-4 w-4 shrink-0" aria-label="Select walk" />
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-semibold">
          <Icon name="paw" className="h-4 w-4 shrink-0 text-brand" />
          {w.pets}
          <ServiceBadge name={w.service ?? "Walk"} colorIndex={w.colorIndex} />
        </p>
        <p className="text-sm text-muted">
          {w.owner} · {w.dateLabel} · {w.priceLabel}
          {w.worker ? ` · ${w.worker}` : ""}
        </p>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
      <div className="flex items-center gap-3">
        <span className="badge bg-brand-soft text-brand-dark">{w.statusLabel}</span>
        {w.bookingId && (
          <Link href={`/admin/bookings/${w.bookingId}`} className="text-sm font-semibold text-brand hover:underline">
            Edit
          </Link>
        )}
        {canComplete && (
          <button
            onClick={() => start(async () => { setError(null); const r = await completeWalk(w.id); if (!r.ok) setError(r.error); })}
            disabled={pending}
            className="btn-primary text-sm"
          >
            {pending ? "…" : "Mark done"}
          </button>
        )}
      </div>
    </div>
  );
}
