"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success",
  PENDING: "bg-warn/15 text-warn",
  SUSPENDED: "bg-danger/10 text-danger",
};

export type ClientRow = {
  id: string;
  owner: string;
  dogs: string[];
  email: string;
  phone: string | null;
  status: string;
  payCadence: string;
  hasCard: boolean;
  archived: boolean;
};

function joinNames(names: string[]) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export function ClientsList({ rows }: { rows: ClientRow[] }) {
  const [q, setQ] = useState("");

  // Search dog names first (that's how they're found day to day), then owner,
  // email and phone.
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [...r.dogs, r.owner, r.email, r.phone ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [rows, q]);

  const active = filtered.filter((r) => !r.archived);
  const archived = filtered.filter((r) => r.archived);
  const searching = q.trim().length > 0;

  return (
    <div className="space-y-5">
      <div className="relative">
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a dog, owner, email or phone…"
          className="input w-full pl-9"
          aria-label="Search clients"
        />
        {searching && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:bg-mist hover:text-brand-dark"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        )}
      </div>

      {searching && (
        <p className="text-sm text-muted">
          {filtered.length === 0
            ? "No matches."
            : `${filtered.length} match${filtered.length === 1 ? "" : "es"}`}
        </p>
      )}

      {active.length > 0 && (
        <div className="grid gap-3">
          {active.map((r) => (
            <ClientCard key={r.id} r={r} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-muted">
            <Icon name="inbox" className="h-4 w-4" />
            Archived ({archived.length})
          </h2>
          <div className="grid gap-3">
            {archived.map((r) => (
              <ClientCard key={r.id} r={r} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClientCard({ r }: { r: ClientRow }) {
  const dogNames = joinNames(r.dogs);
  return (
    <Link
      href={`/admin/clients/${r.id}`}
      className={`card flex flex-wrap items-center justify-between gap-3 transition hover:border-brand/30 hover:shadow-md ${r.archived ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-dark">
          <Icon name="paw" className="h-5 w-5" />
        </span>
        <div>
          {/* Dog first — that's who the walk is for — then the owner. */}
          <p className="font-bold">
            {dogNames || <span className="text-muted">No dogs yet</span>}
            <span className={`ml-2 badge ${STATUS_BADGE[r.status] ?? "bg-border text-muted"}`}>
              {r.status.toLowerCase()}
            </span>
            {r.archived && <span className="ml-1 badge bg-border text-muted">archived</span>}
          </p>
          <p className="text-sm font-semibold text-foreground">{r.owner}</p>
          <p className="text-sm text-muted">
            {r.email}
            {r.phone ? ` · ${r.phone}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="badge bg-background text-foreground">
          <Icon name="paw" className="h-3.5 w-3.5" />
          {r.dogs.length} dog{r.dogs.length !== 1 ? "s" : ""}
        </span>
        <span className="badge bg-background capitalize text-foreground">
          <Icon name="clock" className="h-3.5 w-3.5" />
          {r.payCadence.toLowerCase()}
        </span>
        <span className={`badge ${r.hasCard ? "bg-success/15 text-success" : "bg-warn/15 text-warn"}`}>
          <Icon name="card" className="h-3.5 w-3.5" />
          {r.hasCard ? "Card on file" : "No card"}
        </span>
        <Icon name="chevronRight" className="h-4 w-4 text-muted" />
      </div>
    </Link>
  );
}
