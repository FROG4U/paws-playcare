"use client";

import { useMemo, useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/money";
import { addExtraDays, repriceExtraDay, removeExtraDay, type Result } from "./actions";

export type ClientOption = {
  id: string;
  name: string;
  email: string;
  cadence: string; // "weekly"
  dogs: { id: string; name: string }[];
};
export type ServiceOption = { id: string; name: string; pricePerDog: number };
export type AddedDay = {
  id: string;
  client: string;
  dateLabel: string;
  serviceName: string | null;
  numDogs: number;
  price: number;
  invoiceNumber: string | null;
  invoiceState: "not-invoiced" | "open" | "issued" | "paid";
  completed: boolean;
};

// Mirrors lib/dog-pricing on the server: £14 each once there's more than one.
const MULTI_DOG_MIN = 2;
const MULTI_DOG_PRICE = 1400;
const estimate = (pricePerDog: number, dogs: number) =>
  (dogs >= MULTI_DOG_MIN ? MULTI_DOG_PRICE : pricePerDog) * dogs;

const STATE_BADGE: Record<AddedDay["invoiceState"], { label: string; cls: string }> = {
  "not-invoiced": { label: "Not invoiced yet", cls: "bg-mist text-muted" },
  open: { label: "On current invoice", cls: "bg-brand-soft text-brand-dark" },
  issued: { label: "Invoice issued", cls: "bg-warn/15 text-warn" },
  paid: { label: "Paid", cls: "bg-success/15 text-success" },
};

export function ExtraDaysForm({
  clients,
  services,
  todayIso,
  added,
}: {
  clients: ClientOption[];
  services: ServiceOption[];
  todayIso: string;
  added: AddedDay[];
}) {
  const [q, setQ] = useState("");
  const [clientId, setClientId] = useState("");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [dogIds, setDogIds] = useState<string[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [dateDraft, setDateDraft] = useState("");
  const [priceOverride, setPriceOverride] = useState("");
  const [note, setNote] = useState("");
  const [invoiceNow, setInvoiceNow] = useState(true);

  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const client = clients.find((c) => c.id === clientId) ?? null;
  const service = services.find((s) => s.id === serviceId) ?? null;

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clients.slice(0, 8);
    return clients
      .filter((c) =>
        [c.name, c.email, ...c.dogs.map((d) => d.name)].join(" ").toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [clients, q]);

  const perWalk =
    priceOverride.trim() !== ""
      ? Math.round(parseFloat(priceOverride) * 100) || 0
      : service
        ? estimate(service.pricePerDog, dogIds.length || 1)
        : 0;

  function pick(c: ClientOption) {
    setClientId(c.id);
    setDogIds(c.dogs.map((d) => d.id)); // all their dogs by default
    setQ("");
    setMessage(null);
  }

  function addDate() {
    const d = dateDraft.trim();
    if (!d || dates.includes(d)) return;
    setDates((prev) => [...prev, d].sort());
    setDateDraft("");
  }

  function run(fn: () => Promise<Result>, onOk?: () => void) {
    setError(null);
    setMessage(null);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setMessage(res.message);
        onOk?.();
      } else setError(res.error);
    });
  }

  function submit() {
    if (!client || !service) return;
    run(
      () =>
        addExtraDays({
          clientId: client.id,
          serviceId: service.id,
          dogIds,
          dates,
          pricePence: priceOverride.trim() !== "" ? perWalk : null,
          note: note || null,
          invoiceNow,
        }),
      () => {
        setDates([]);
        setPriceOverride("");
        setNote("");
      }
    );
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-4">
        <h2 className="text-base font-bold">Add days for a client</h2>

        {/* 1 — client */}
        {!client ? (
          <div className="space-y-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-semibold text-muted">Client</span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search a dog, owner or email…"
                className="input w-full"
              />
            </label>
            <div className="grid gap-1.5">
              {matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-brand hover:bg-brand-soft/40"
                >
                  <span>
                    <span className="font-bold">
                      {c.dogs.map((d) => d.name).join(" & ") || "No dogs"}
                    </span>
                    <span className="text-muted"> · {c.name}</span>
                  </span>
                  <span className="badge bg-background capitalize text-muted">{c.cadence}</span>
                </button>
              ))}
              {matches.length === 0 && <p className="text-sm text-muted">No matches.</p>}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-soft/50 px-3 py-2 text-sm">
            <span>
              <strong>{client.dogs.map((d) => d.name).join(" & ") || "No dogs"}</strong> · {client.name}
              <span className="text-muted"> · billed {client.cadence}</span>
            </span>
            <button
              type="button"
              onClick={() => { setClientId(""); setDogIds([]); }}
              className="text-xs font-semibold text-brand hover:underline"
            >
              Change
            </button>
          </div>
        )}

        {client && (
          <>
            {/* 2 — service + dogs */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">Service</span>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="input w-full"
                >
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>

              <div className="text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">Dogs</span>
                <div className="flex flex-wrap gap-2">
                  {client.dogs.map((d) => {
                    const on = dogIds.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          setDogIds((prev) =>
                            prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                          )
                        }
                        className={
                          on
                            ? "rounded-full bg-brand px-3 py-1.5 text-sm font-bold text-white"
                            : "rounded-full border border-border px-3 py-1.5 text-sm font-semibold text-muted hover:border-brand hover:text-brand"
                        }
                      >
                        {d.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3 — dates */}
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-muted">Days</span>
              <div className="flex flex-wrap items-end gap-2">
                <input
                  type="date"
                  value={dateDraft}
                  onChange={(e) => setDateDraft(e.target.value)}
                  className="input py-1.5 text-sm"
                />
                <button type="button" onClick={addDate} disabled={!dateDraft} className="btn-outline text-sm disabled:opacity-50">
                  <Icon name="plus" className="h-4 w-4" /> Add day
                </button>
                <span className="text-xs text-muted">
                  Any date — past days you've already walked are fine.
                </span>
              </div>
              {dates.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {dates.map((d) => (
                    <span key={d} className="badge bg-brand-soft text-brand-dark">
                      {new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
                        weekday: "short", day: "numeric", month: "short",
                      })}
                      <button
                        type="button"
                        onClick={() => setDates((prev) => prev.filter((x) => x !== d))}
                        aria-label={`Remove ${d}`}
                        className="ml-1 text-brand hover:text-danger"
                      >
                        <Icon name="x" className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 4 — price + note */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">
                  Price per day (blank = usual rate)
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceOverride}
                  onChange={(e) => setPriceOverride(e.target.value)}
                  placeholder={service ? (estimate(service.pricePerDog, dogIds.length || 1) / 100).toFixed(2) : ""}
                  className="input w-full"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold text-muted">Note (optional)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. covered Bank Holiday Monday"
                  className="input w-full"
                />
              </label>
            </div>

            {/* 5 — bill now? */}
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={invoiceNow}
                onChange={(e) => setInvoiceNow(e.target.checked)}
                className="mt-1"
              />
              <span>
                <strong>Invoice these days now</strong> — marks them done and puts them straight on{" "}
                {client.name.split(" ")[0]}'s current invoice, collected on their {client.cadence} cycle.
                Untick to just put the days in the diary and bill them when they're marked done.
              </span>
            </label>

            {dates.length > 0 && (
              <p className="rounded-lg bg-background px-3 py-2 text-sm">
                {dates.length} day{dates.length > 1 ? "s" : ""} × {formatMoney(perWalk)} ={" "}
                <strong>{formatMoney(perWalk * dates.length)}</strong>
              </p>
            )}

            <button
              onClick={submit}
              disabled={pending || dates.length === 0 || dogIds.length === 0}
              className="btn-primary disabled:opacity-50"
            >
              {pending ? "Saving…" : invoiceNow ? "Add days & invoice" : "Add days"}
            </button>
          </>
        )}

        {error && <p className="text-sm text-danger">{error}</p>}
        {message && <p className="text-sm font-semibold text-brand">{message}</p>}
      </section>

      {added.length > 0 && (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Icon name="receipt" className="h-5 w-5 text-brand" />
            Days added by hand
          </h2>
          <div className="space-y-2">
            {added.map((d) => (
              <AddedRow key={d.id} d={d} onRun={run} pending={pending} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function AddedRow({
  d,
  onRun,
  pending,
}: {
  d: AddedDay;
  onRun: (fn: () => Promise<Result>, onOk?: () => void) => void;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [price, setPrice] = useState((d.price / 100).toFixed(2));
  const locked = d.invoiceState === "paid";
  const badge = STATE_BADGE[d.invoiceState];

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 text-sm">
      <div>
        <p className="font-bold">
          {d.client}
          <span className="ml-2 font-normal text-muted">
            {d.serviceName ?? "Walk"} · {d.dateLabel} · {d.numDogs} dog{d.numDogs > 1 ? "s" : ""}
          </span>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className={`badge ${badge.cls}`}>{badge.label}</span>
          {d.invoiceNumber && <span className="text-muted">{d.invoiceNumber}</span>}
          {!d.completed && <span className="badge bg-mist text-muted">not marked done</span>}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <input
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="input w-24 py-1.5 text-sm"
            />
            <button
              onClick={() =>
                onRun(() => repriceExtraDay(d.id, Math.round(parseFloat(price) * 100)), () => setEditing(false))
              }
              disabled={pending}
              className="btn-primary text-sm disabled:opacity-50"
            >
              Save
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost text-sm">Cancel</button>
          </>
        ) : (
          <>
            <span className="font-bold">{formatMoney(d.price)}</span>
            {locked ? (
              <span className="text-xs text-muted">Paid — refund in Stripe to change</span>
            ) : (
              <>
                <button onClick={() => setEditing(true)} className="btn-outline text-sm">
                  <Icon name="pencil" className="h-4 w-4" /> Price
                </button>
                <button
                  onClick={() => onRun(() => removeExtraDay(d.id))}
                  disabled={pending}
                  className="btn-ghost text-sm text-danger disabled:opacity-50"
                >
                  <Icon name="trash" className="h-4 w-4" /> Remove
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
