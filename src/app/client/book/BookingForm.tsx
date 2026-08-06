"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Where the in-progress booking is stashed while the client pops over to add a
// payment card, so nothing they filled in is lost.
const DRAFT_KEY = "ppc-booking-draft";
import { formatMoney } from "@/lib/money";
import { Icon } from "@/components/Icon";
import { createBooking, type BookInput } from "./actions";
import { ServiceCalendar, SERVICE_PALETTE } from "./ServiceCalendar";

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
  hasCard,
}: {
  services: BookServiceOption[];
  dogs: BookDogOption[];
  bankHolidays: string[];
  todayIso: string;
  hasCard: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; skipped: number; ongoing: boolean; bookings: number } | null>(null);

  const bhSet = useMemo(() => new Set(bankHolidays), [bankHolidays]);

  const [serviceIds, setServiceIds] = useState<string[]>([services[0].id]);
  const [dogIds, setDogIds] = useState<string[]>(dogs.length === 1 ? [dogs[0].id] : []);

  // Regular (ongoing repeating) booking
  const [daysByService, setDaysByService] = useState<Record<string, number[]>>({
    [services[0].id]: services[0].days,
  });
  const [startDate, setStartDate] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  // Extra one-off days (collapsible)
  const [extraOpen, setExtraOpen] = useState(false);
  const [dates, setDates] = useState<string[]>([]);

  // Coming back from adding a card mid-booking → restore what they'd filled in.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      sessionStorage.removeItem(DRAFT_KEY);
      const d = JSON.parse(raw);
      if (Array.isArray(d.serviceIds) && d.serviceIds.length) setServiceIds(d.serviceIds);
      if (Array.isArray(d.dogIds)) setDogIds(d.dogIds);
      if (d.daysByService && typeof d.daysByService === "object") setDaysByService(d.daysByService);
      if (typeof d.startDate === "string") setStartDate(d.startDate);
      if (typeof d.agreeTerms === "boolean") setAgreeTerms(d.agreeTerms);
      if (Array.isArray(d.dates)) setDates(d.dates);
      if (typeof d.extraOpen === "boolean") setExtraOpen(d.extraOpen);
    } catch {
      // ignore a malformed draft
    }
  }, []);

  const selectedServices = useMemo(
    () => services.filter((s) => serviceIds.includes(s.id)),
    [services, serviceIds]
  );
  const numDogs = dogIds.length;
  const dogMult = Math.max(1, numDogs);

  // Extra dates route to whichever service runs that weekday (calendar blocks
  // weekends/holidays, so `bad` is a safety net).
  const routing = useMemo(() => {
    const byService: Record<string, string[]> = {};
    const bad: { date: string; reason: string }[] = [];
    for (const d of dates) {
      const wd = isoWeekday(d);
      if (wd > 5) { bad.push({ date: d, reason: "weekend" }); continue; }
      if (bhSet.has(d)) { bad.push({ date: d, reason: "bank holiday" }); continue; }
      const svc = services.find((s) => s.days.includes(wd));
      if (!svc) bad.push({ date: d, reason: "no service" });
      else (byService[svc.id] ||= []).push(d);
    }
    const count = Object.values(byService).reduce((n, a) => n + a.length, 0);
    return { byService, bad, count };
  }, [dates, services, bhSet]);

  const routedServices = useMemo(
    () => services.filter((s) => (routing.byService[s.id]?.length ?? 0) > 0),
    [services, routing]
  );
  const datesTotal = useMemo(() => {
    let total = 0;
    for (const s of services) total += s.pricePerDog * dogMult * (routing.byService[s.id]?.length ?? 0);
    return total;
  }, [services, routing, dogMult]);

  // Exact schedule for the regular ongoing booking over the next 12 weeks.
  const repeatPlan = useMemo(() => {
    // -1 so the inclusive window spans exactly 12 weeks (84 days), not 85 —
    // otherwise the start weekday is counted a 13th time.
    const effEnd = startDate ? addDaysIso(startDate, ONGOING_HORIZON_DAYS - 1) : "";
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
  }, [selectedServices, daysByService, startDate, dogMult, bhSet]);

  // Walks per week + weekly cost, based on the regular days actually selected.
  const weeklyCount = useMemo(
    () => selectedServices.reduce((n, s) => n + (daysByService[s.id]?.length ?? 0), 0),
    [selectedServices, daysByService]
  );
  const weeklyTotal = useMemo(
    () => selectedServices.reduce((t, s) => t + s.pricePerDog * dogMult * (daysByService[s.id]?.length ?? 0), 0),
    [selectedServices, daysByService, dogMult]
  );

  const regularHasDays = selectedServices.some((s) => (daysByService[s.id]?.length ?? 0) > 0);
  // Drives the price/summary display — depends only on the chosen schedule, NOT
  // on the T&C tick (ticking a legal box must never change the shown price).
  // The T&C is enforced separately in submitRegular().
  const regularReady = regularHasDays && !!startDate && numDogs > 0 && repeatPlan.count > 0;
  const extraReady = dates.length > 0 && routing.bad.length === 0 && numDogs > 0;

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
  const toggleDate = (d: string) =>
    setDates((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort()));
  const removeDate = (d: string) => setDates((p) => p.filter((x) => x !== d));

  function runInputs(inputs: BookInput[]) {
    // No card yet → stash the booking and send them to add a card; they'll come
    // straight back here with everything intact and can submit.
    if (!hasCard) {
      try {
        sessionStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ serviceIds, dogIds, daysByService, startDate, agreeTerms, dates, extraOpen })
        );
      } catch {
        // sessionStorage unavailable — proceed to payment anyway
      }
      router.push("/client/payment?next=book");
      return;
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

  function submitRegular() {
    setError(null);
    if (numDogs === 0) { setError("Please select at least one dog."); return; }
    if (!regularHasDays) { setError("Please choose at least one regular day."); return; }
    if (!startDate) { setError("Please pick a start date."); return; }
    if (!agreeTerms) { setError("Please tick the box to agree to the weekly terms."); return; }
    const inputs: BookInput[] = [];
    for (const s of selectedServices) {
      const ds = daysByService[s.id] ?? [];
      if (ds.length > 0) {
        inputs.push({ serviceId: s.id, dogIds, mode: "REPEAT", days: ds, startDate, endMode: "FOREVER", agreeWeekly: true });
      }
    }
    if (inputs.length === 0) { setError("Please choose at least one regular day."); return; }
    runInputs(inputs);
  }

  function submitExtra() {
    setError(null);
    if (numDogs === 0) { setError("Please select at least one dog."); return; }
    if (dates.length === 0) { setError("Please tap at least one extra day."); return; }
    if (routing.bad.length > 0) {
      setError(`These dates can't be booked: ${routing.bad.map((b) => `${prettyDate(b.date)} (${b.reason})`).join(", ")}.`);
      return;
    }
    const inputs: BookInput[] = [];
    for (const s of services) {
      const ds = routing.byService[s.id];
      if (ds && ds.length > 0) inputs.push({ serviceId: s.id, dogIds, mode: "DATES", dates: ds });
    }
    runInputs(inputs);
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
          <button className="btn-outline" onClick={() => { setDone(null); setDates([]); setAgreeTerms(false); setExtraOpen(false); }}>
            Book more
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Dogs (shared) */}
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

      {/* Regular days (the main, ongoing booking) */}
      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon name="calendar" className="h-5 w-5 text-brand" />
          Please select your {dogs.length > 1 ? "dogs’" : "dog’s"} regular day(s)
        </h2>

        {selectedServices.map((s) => {
          const svcIdx = services.findIndex((x) => x.id === s.id);
          const pal = SERVICE_PALETTE[svcIdx % SERVICE_PALETTE.length];
          return (
            <div key={s.id}>
              <label className="label">
                <span style={{ color: pal.softText }}>{s.name}</span>
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
                      className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${on ? "text-white shadow-sm" : "border border-border bg-surface text-foreground hover:opacity-80"}`}
                      style={on ? { backgroundColor: pal.solid } : { color: pal.softText, borderColor: pal.solid }}
                    >
                      {DAY_SHORT[d]}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div>
          <label className="label">Start date</label>
          <input type="date" min={todayIso} value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input" />
          <p className="mt-1 text-xs text-muted">Walks repeat every week with no end date. Bank holidays are skipped automatically.</p>
        </div>

        {/* Terms & conditions */}
        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border bg-background p-3">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
          <span className="text-sm">
            I confirm I&apos;m happy for my dog{dogs.length > 1 ? "s" : ""} to attend each week, and I agree to give a
            minimum of <strong>7 days&apos; notice</strong> to cancel a walk to avoid a charge.
          </span>
        </label>

        <div className="flex items-center justify-between">
          <span className="text-muted">
            {regularReady
              ? `Next 12 weeks · ${repeatPlan.count} walk${repeatPlan.count !== 1 ? "s" : ""}`
              : weeklyCount > 0
                ? `Per week · ${weeklyCount} walk${weeklyCount !== 1 ? "s" : ""}`
                : "Per walk"}
          </span>
          <span className="text-lg font-bold">
            {regularReady ? formatMoney(repeatPlan.total) : weeklyCount > 0 ? formatMoney(weeklyTotal) : formatMoney(selectedServices[0]?.pricePerDog * dogMult)}
          </span>
        </div>
        <p className="text-xs text-muted">
          {formatMoney(selectedServices[0]?.pricePerDog ?? 0)} per dog, per walk{numDogs > 1 ? ` · ${numDogs} dogs` : ""}.
          {weeklyCount > 0 ? ` You've chosen ${weeklyCount} walk${weeklyCount !== 1 ? "s" : ""} a week.` : ""}
        </p>
        {regularReady && (
          <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand-dark">
            🐾 {joinNames(selectedServices.filter((s) => (daysByService[s.id]?.length ?? 0) > 0).map((s) => `${s.name} every ${joinDays(daysByService[s.id])}`))}, starting {repeatPlan.first ? prettyDate(repeatPlan.first) : "…"}, repeating with no end date.
          </p>
        )}
        <button onClick={submitRegular} disabled={pending} className="btn-primary w-full">
          {pending ? "Booking…" : hasCard ? "Set up regular walks" : "Continue to add a card"}
        </button>
        {!hasCard && (
          <p className="text-center text-xs text-muted">
            You&apos;ll add a payment card to confirm — we&apos;ll bring you right back here with your booking.
          </p>
        )}
      </section>

      {/* Extra one-off days (collapsible) */}
      <section className="card">
        <button
          type="button"
          onClick={() => setExtraOpen((o) => !o)}
          className="flex w-full items-center justify-between gap-2 text-left"
          aria-expanded={extraOpen}
        >
          <span className="flex items-center gap-2 text-lg font-bold">
            <Icon name="calendar" className="h-5 w-5 text-brand" />
            Pick your extra day(s)
          </span>
          <Icon name="chevronRight" className={`h-5 w-5 text-muted transition ${extraOpen ? "rotate-90" : ""}`} />
        </button>
        <p className="mt-1 text-sm text-muted">Optional — add one-off extra dates on top of your regular walks.</p>

        {extraOpen && (
          <div className="mt-4 space-y-3">
            <label className="label">Tap the days you&apos;d like</label>
            <ServiceCalendar
              services={services}
              selected={dates}
              onToggle={toggleDate}
              todayIso={todayIso}
              bankHolidays={bhSet}
            />
            {dates.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {dates.map((d) => {
                  const wd = isoWeekday(d);
                  const svcIdx = wd <= 5 && !bhSet.has(d) ? services.findIndex((s) => s.days.includes(wd)) : -1;
                  const svc = svcIdx >= 0 ? services[svcIdx] : undefined;
                  const badReason = wd > 5 ? "weekend" : bhSet.has(d) ? "bank holiday" : svc ? null : "no service";
                  const pal = svcIdx >= 0 ? SERVICE_PALETTE[svcIdx % SERVICE_PALETTE.length] : null;
                  return (
                    <span
                      key={d}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${badReason ? "bg-danger/10 text-danger" : ""}`}
                      style={pal && !badReason ? { backgroundColor: pal.soft, color: pal.softText } : undefined}
                    >
                      {prettyDate(d)}
                      {svc ? ` · ${svc.name}` : ""}
                      {badReason ? ` · ${badReason}` : ""}
                      <button type="button" onClick={() => removeDate(d)} aria-label={`Remove ${d}`} className="opacity-60 hover:text-danger">×</button>
                    </span>
                  );
                })}
              </div>
            )}
            <p className="text-xs text-muted">
              Each date is booked with the service that runs that weekday. Weekends and bank holidays aren&apos;t available.
            </p>
            <div className="flex items-center justify-between">
              <span className="text-muted">{extraReady ? `Total · ${routing.count} extra walk${routing.count !== 1 ? "s" : ""}` : "Extra days"}</span>
              <span className="text-lg font-bold">{extraReady ? formatMoney(datesTotal) : "—"}</span>
            </div>
            <button onClick={submitExtra} disabled={pending || !extraReady} className="btn-primary w-full">
              {pending ? "Booking…" : hasCard ? "Add extra day(s)" : "Continue to add a card"}
            </button>
            {!hasCard && extraReady && (
              <p className="text-center text-xs text-muted">
                You&apos;ll add a payment card to confirm — we&apos;ll bring you right back here.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
