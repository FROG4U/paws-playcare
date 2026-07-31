"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { Icon } from "@/components/Icon";
import { createBooking, type BookInput } from "./actions";

export type BookServiceOption = {
  id: string;
  name: string;
  timeSlot: string;
  pricePerDog: number;
  days: number[]; // ISO weekdays 1..5
};
export type BookDogOption = { id: string; name: string };

// Keep in step with ONGOING_HORIZON_DAYS in actions.ts.
const ONGOING_HORIZON_DAYS = 12 * 7;

const DAY_SHORT: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };
const SLOT_LABEL: Record<string, string> = { AM: "Mornings", LUNCH: "Lunch time", PM: "Afternoons" };

function prettyDate(iso: string): string {
  const d = new Date(iso + "T00:00:00.000Z");
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
function isoWeekday(iso: string): number {
  const wd = new Date(iso + "T00:00:00.000Z").getUTCDay();
  return wd === 0 ? 7 : wd;
}
function addDaysIso(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00.000Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Mirrors server expandRecurring: weekday in `days`, never a weekend, never a
// bank holiday. Returns the yyyy-mm-dd strings that would actually be booked.
function expandDaysIso(days: number[], startIso: string, endIso: string, bh: Set<string>): string[] {
  const out: string[] = [];
  if (!startIso || !endIso) return out;
  let cur = new Date(startIso + "T00:00:00.000Z");
  const last = new Date(endIso + "T00:00:00.000Z");
  let guard = 0;
  while (cur.getTime() <= last.getTime() && guard++ < 3660) {
    const wd = cur.getUTCDay() === 0 ? 7 : cur.getUTCDay();
    const iso = cur.toISOString().slice(0, 10);
    if (days.includes(wd) && wd <= 5 && !bh.has(iso)) out.push(iso);
    cur = new Date(cur.getTime() + 86400000);
  }
  return out;
}
// "Mon, Tue & Wed" from [1,2,3]
function joinDays(ds: number[]): string {
  const names = [...ds].sort((a, b) => a - b).map((d) => DAY_SHORT[d]);
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
}
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
}

export function BookingForm({
  services,
  dogs,
  bankHolidays,
  todayIso,
}: {
  services: BookServiceOption[];
  dogs: BookDogOption[];
  bankHolidays: string[];
  todayIso: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; skipped: number; ongoing: boolean; bookings: number } | null>(null);

  const bhSet = useMemo(() => new Set(bankHolidays), [bankHolidays]);

  const [serviceIds, setServiceIds] = useState<string[]>([services[0].id]);
  const [dogIds, setDogIds] = useState<string[]>(dogs.length === 1 ? [dogs[0].id] : []);
  const [mode, setMode] = useState<"DATES" | "REPEAT">("DATES");

  const [dates, setDates] = useState<string[]>([]);
  const [dateDraft, setDateDraft] = useState("");

  const [daysByService, setDaysByService] = useState<Record<string, number[]>>({
    [services[0].id]: services[0].days,
  });
  const [startDate, setStartDate] = useState("");
  const [endMode, setEndMode] = useState<"DATE" | "FOREVER">("DATE");
  const [endDate, setEndDate] = useState("");

  const selectedServices = useMemo(
    () => services.filter((s) => serviceIds.includes(s.id)),
    [services, serviceIds]
  );
  const numDogs = dogIds.length;
  const dogMult = Math.max(1, numDogs);

  // Route each specific date to the selected service running that weekday, and
  // flag any that can't be booked (weekend / bank holiday / no matching service).
  const routing = useMemo(() => {
    const byService: Record<string, string[]> = {};
    const bad: { date: string; reason: string }[] = [];
    for (const d of dates) {
      const wd = isoWeekday(d);
      if (wd > 5) { bad.push({ date: d, reason: "weekend" }); continue; }
      if (bhSet.has(d)) { bad.push({ date: d, reason: "bank holiday" }); continue; }
      const svc = selectedServices.find((s) => s.days.includes(wd));
      if (!svc) bad.push({ date: d, reason: "no service" });
      else (byService[svc.id] ||= []).push(d);
    }
    const count = Object.values(byService).reduce((n, a) => n + a.length, 0);
    return { byService, bad, count };
  }, [dates, selectedServices, bhSet]);

  const datesTotal = useMemo(() => {
    let total = 0;
    for (const s of selectedServices) total += s.pricePerDog * dogMult * (routing.byService[s.id]?.length ?? 0);
    return total;
  }, [selectedServices, routing, dogMult]);

  // Exact schedule for a repeat booking (bounded end date, or the 12-week
  // horizon for "until I stop it") — so we can show the real total, not a guess.
  const repeatPlan = useMemo(() => {
    const effEnd = endMode === "DATE" ? endDate : (startDate ? addDaysIso(startDate, ONGOING_HORIZON_DAYS) : "");
    let total = 0, count = 0;
    let first: string | null = null;
    if (startDate && effEnd) {
      for (const s of selectedServices) {
        const ds = daysByService[s.id] ?? [];
        if (ds.length === 0) continue;
        const list = expandDaysIso(ds, startDate, effEnd, bhSet);
        count += list.length;
        total += s.pricePerDog * dogMult * list.length;
        if (list.length && (!first || list[0] < first)) first = list[0];
      }
    }
    return { total, count, first };
  }, [selectedServices, daysByService, startDate, endMode, endDate, dogMult, bhSet]);

  const ready =
    mode === "DATES"
      ? dates.length > 0 && routing.bad.length === 0
      : selectedServices.some((s) => (daysByService[s.id]?.length ?? 0) > 0) &&
        !!startDate &&
        (endMode === "FOREVER" || !!endDate) &&
        repeatPlan.count > 0;

  const summary = useMemo(() => {
    const svcList = joinNames(selectedServices.map((s) => s.name));
    if (mode === "DATES") {
      if (dates.length === 0) return `Choose the days you'd like ${svcList || "a walk"}.`;
      return `${routing.count} walk${routing.count !== 1 ? "s" : ""} across ${svcList}.`;
    }
    const parts = selectedServices
      .filter((s) => (daysByService[s.id]?.length ?? 0) > 0)
      .map((s) => `${s.name} every ${joinDays(daysByService[s.id])}`);
    if (parts.length === 0) return `Choose the days you'd like ${svcList || "a walk"}.`;
    const startStr = repeatPlan.first ? prettyDate(repeatPlan.first) : startDate ? prettyDate(startDate) : "…";
    const endStr = endMode === "DATE" ? (endDate ? `until ${prettyDate(endDate)}` : "until …") : "with no end date";
    return `${joinNames(parts)}, starting ${startStr}, ${endStr}.`;
  }, [mode, dates, routing, selectedServices, daysByService, startDate, endMode, endDate, repeatPlan]);

  function toggleService(id: string) {
    setServiceIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        setDaysByService((d) => { const { [id]: _drop, ...rest } = d; return rest; });
        return prev.filter((x) => x !== id);
      }
      const svc = services.find((s) => s.id === id)!;
      setDaysByService((d) => ({ ...d, [id]: svc.days }));
      return [...prev, id];
    });
  }
  const toggleDog = (id: string) => setDogIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleDay = (serviceId: string, d: number) =>
    setDaysByService((prev) => {
      const cur = prev[serviceId] ?? [];
      const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b);
      return { ...prev, [serviceId]: next };
    });
  function addDate() {
    if (!dateDraft) return;
    setDates((p) => (p.includes(dateDraft) ? p : [...p, dateDraft].sort()));
    setDateDraft("");
  }
  const removeDate = (d: string) => setDates((p) => p.filter((x) => x !== d));

  function submit() {
    setError(null);
    if (numDogs === 0) { setError("Please select at least one dog."); return; }

    const inputs: BookInput[] = [];
    if (mode === "DATES") {
      if (dates.length === 0) { setError("Please add at least one date."); return; }
      if (routing.bad.length > 0) {
        setError(`These dates can't be booked: ${routing.bad.map((b) => `${prettyDate(b.date)} (${b.reason})`).join(", ")}.`);
        return;
      }
      for (const s of selectedServices) {
        const ds = routing.byService[s.id];
        if (ds && ds.length > 0) inputs.push({ serviceId: s.id, dogIds, mode: "DATES", dates: ds });
      }
    } else {
      if (!startDate) { setError("Please pick a start date."); return; }
      if (endMode === "DATE" && !endDate) { setError("Please pick an end date, or choose to repeat ongoing."); return; }
      for (const s of selectedServices) {
        const ds = daysByService[s.id] ?? [];
        if (ds.length > 0) {
          inputs.push({ serviceId: s.id, dogIds, mode: "REPEAT", days: ds, startDate, endMode, endDate: endMode === "DATE" ? endDate : undefined });
        }
      }
      if (inputs.length === 0) { setError("Please choose at least one day of the week."); return; }
    }

    startTransition(async () => {
      let created = 0, skipped = 0, ongoing = false, bookings = 0;
      for (const inp of inputs) {
        const res = await createBooking(inp);
        if (!res.ok) {
          setError(bookings > 0 ? `${res.error} (${bookings} of your bookings were already set up — check "My walks".)` : res.error);
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        created += res.created; skipped += res.skipped; ongoing = ongoing || res.ongoing; bookings += 1;
      }
      setDone({ created, skipped, ongoing, bookings });
      router.refresh();
    });
  }

  if (done) {
    return (
      <div className="card space-y-3 border-l-4 border-l-brand">
        <h2 className="text-lg font-bold">Booking requested 🎉</h2>
        <p className="text-muted">
          {done.created} walk{done.created !== 1 ? "s" : ""} requested
          {done.bookings > 1 ? ` across ${done.bookings} services` : ""}
          {done.ongoing ? " (repeating ongoing)" : ""}. Our team will assign a walker and confirm.
          {done.skipped > 0 && ` We skipped ${done.skipped} bank-holiday date${done.skipped > 1 ? "s" : ""} — see your notifications.`}
        </p>
        <div className="flex gap-2">
          <Link href="/client/walks" className="btn-primary">View my walks</Link>
          <button className="btn-outline" onClick={() => { setDone(null); setDates([]); setDogIds(dogs.length === 1 ? [dogs[0].id] : []); }}>
            Book another
          </button>
        </div>
      </div>
    );
  }

  const perWalkList = selectedServices.map((s) => formatMoney(s.pricePerDog * dogMult)).join(" + ");

  // Price row content depends on mode + readiness.
  let priceLabel = "Price per walk";
  let priceValue = perWalkList;
  let priceNote = `${formatMoney(selectedServices[0]?.pricePerDog ?? 0)} × ${dogMult} dog${dogMult > 1 ? "s" : ""} per walk`;
  if (mode === "DATES" && dates.length > 0 && routing.bad.length === 0) {
    priceLabel = `Total · ${routing.count} walk${routing.count !== 1 ? "s" : ""}`;
    priceValue = formatMoney(datesTotal);
    priceNote = `${perWalkList} per walk × the dates you picked.`;
  } else if (mode === "REPEAT" && ready) {
    priceValue = formatMoney(repeatPlan.total);
    if (endMode === "DATE") {
      priceLabel = `Total · ${repeatPlan.count} walk${repeatPlan.count !== 1 ? "s" : ""}`;
      priceNote = `${perWalkList} per walk × ${repeatPlan.count} scheduled date${repeatPlan.count !== 1 ? "s" : ""} (bank holidays skipped).`;
    } else {
      priceLabel = `Next 12 weeks · ${repeatPlan.count} walk${repeatPlan.count !== 1 ? "s" : ""}`;
      priceNote = `${perWalkList} per walk — then it keeps repeating and you're charged as walks happen.`;
    }
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Services (multi-select) */}
      <section className="card space-y-3">
        <div className="flex items-start gap-2">
          <Icon name="paw" className="mt-0.5 h-5 w-5 text-brand" />
          <div>
            <h2 className="text-lg font-bold">Services</h2>
            <p className="text-sm text-muted">Pick one or more — you can book Field Play and Walks together.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {services.map((s) => {
            const active = serviceIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleService(s.id)}
                aria-pressed={active}
                className={`rounded-xl border p-4 text-left transition ${active ? "border-brand bg-brand/5 ring-1 ring-brand" : "border-border hover:bg-brand-soft"}`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-bold">{s.name}</p>
                  <span className={`grid h-5 w-5 place-items-center rounded-full border text-xs ${active ? "border-brand bg-brand text-white" : "border-border text-transparent"}`}>✓</span>
                </div>
                <p className="text-sm text-muted">{s.days.map((d) => DAY_SHORT[d]).join(" · ")} · {SLOT_LABEL[s.timeSlot] ?? s.timeSlot}</p>
                <p className="mt-1 text-sm font-semibold">{formatMoney(s.pricePerDog)} per dog</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Dogs */}
      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon name="paw" className="h-5 w-5 text-brand" />
          Which dog{dogs.length > 1 ? "s" : ""}?
        </h2>
        <div className="flex flex-wrap gap-2">
          {dogs.map((d) => (
            <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/10">
              <input type="checkbox" checked={dogIds.includes(d.id)} onChange={() => toggleDog(d.id)} />
              {d.name}
            </label>
          ))}
        </div>
      </section>

      {/* When */}
      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon name="calendar" className="h-5 w-5 text-brand" />
          When would you like {selectedServices.length === 1 ? selectedServices[0].name : "your walks"}?
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {([["DATES", "Pick dates"], ["REPEAT", "Repeat weekly"]] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${mode === m ? "border-brand bg-brand text-white" : "border-border bg-surface hover:bg-brand-soft"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "DATES" ? (
          <div className="space-y-3">
            <label className="label">Add one or more dates</label>
            <div className="flex gap-2">
              <input type="date" min={todayIso} value={dateDraft} onChange={(e) => setDateDraft(e.target.value)} className="input" />
              <button type="button" onClick={addDate} className="btn-accent shrink-0">Add</button>
            </div>
            {dates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dates.map((d) => {
                  const wd = isoWeekday(d);
                  const svc = wd <= 5 && !bhSet.has(d) ? selectedServices.find((s) => s.days.includes(wd)) : undefined;
                  const badReason = wd > 5 ? "weekend" : bhSet.has(d) ? "bank holiday" : svc ? null : "no service";
                  return (
                    <span key={d} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${badReason ? "bg-danger/10 text-danger" : "bg-brand-soft text-brand-dark"}`}>
                      {prettyDate(d)}
                      {svc && selectedServices.length > 1 ? ` · ${svc.name}` : ""}
                      {badReason ? ` · ${badReason}` : ""}
                      <button type="button" onClick={() => removeDate(d)} aria-label={`Remove ${d}`} className="opacity-60 hover:text-danger">×</button>
                    </span>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted">
              Each date is booked with the service that runs that weekday
              {selectedServices.length > 1 ? " (shown on each date)" : ""}. Weekends and bank holidays aren&apos;t available.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {selectedServices.map((s) => (
              <div key={s.id}>
                <label className="label">
                  Repeat {selectedServices.length > 1 ? <span className="text-brand-dark">{s.name}</span> : ""} on
                </label>
                <div className="flex flex-wrap gap-2">
                  {s.days.map((d) => {
                    const on = (daysByService[s.id] ?? []).includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => toggleDay(s.id, d)}
                        aria-pressed={on}
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${on ? "bg-brand text-white shadow-sm" : "border border-border bg-surface text-foreground hover:bg-brand-soft"}`}
                      >
                        {DAY_SHORT[d]}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            <div>
              <label className="label">Start date</label>
              <input type="date" min={todayIso} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
            </div>

            <div>
              <label className="label">Ends</label>
              <div className="grid grid-cols-2 gap-2">
                {([["DATE", "Until a date"], ["FOREVER", "Until I stop it"]] as const).map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setEndMode(m)}
                    className={`rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${endMode === m ? "border-brand bg-brand text-white" : "border-border bg-surface hover:bg-brand-soft"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {endMode === "DATE" ? (
                <input type="date" min={startDate || todayIso} value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input mt-2" />
              ) : (
                <p className="mt-2 text-xs text-muted">We&apos;ll schedule the next 12 weeks now and keep it going.</p>
              )}
            </div>

            <p className="text-xs text-muted">Any date that falls on a bank holiday is skipped automatically.</p>
          </div>
        )}
      </section>

      {/* Summary + submit */}
      <section className="card space-y-3">
        <p className={`rounded-lg px-3 py-2.5 text-sm ${ready ? "bg-brand-soft font-medium text-brand-dark" : "bg-background text-muted"}`}>
          {ready ? `🐾 You're booking: ${summary} Weekends and bank holidays are skipped automatically.` : summary}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-muted">{priceLabel}</span>
          <span className="text-lg font-bold">{priceValue}</span>
        </div>
        <p className="text-xs text-muted">{priceNote}</p>
        <button onClick={submit} disabled={pending} className="btn-primary w-full">
          {pending ? "Booking…" : mode === "DATES" ? "Request these walks" : "Set up repeating walks"}
        </button>
      </section>
    </div>
  );
}
