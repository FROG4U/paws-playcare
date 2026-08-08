"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { Icon } from "@/components/Icon";
import { formatMoney } from "@/lib/money";
import { monthView, previewPrice, startFieldBooking, type DaySummary } from "./actions";

let _stripePromise: Promise<Stripe | null> | null = null;
function stripePromise(key: string) {
  if (!_stripePromise) _stripePromise = loadStripe(key);
  return _stripePromise;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const STRIPE_MIN = 30; // pence — below this there's nothing to pay

function isoWeekdayOf(dateKey: string): number {
  const wd = new Date(dateKey + "T00:00:00.000Z").getUTCDay();
  return wd === 0 ? 7 : wd;
}
function prettyDate(dateKey: string): string {
  return new Date(dateKey + "T00:00:00.000Z").toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}
function shortDate(dateKey: string): string {
  return new Date(dateKey + "T00:00:00.000Z").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
  });
}
function hhmm(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}
function slotLabel(h: number) {
  return `${hhmm(h)} – ${hhmm(h + 1)}`;
}

type FieldClient = { name: string; email: string; phone?: string; carReg?: string } | null;
type Hours = { open: number; close: number };

export function FieldBooking({
  initialYear,
  initialMonth,
  initialDays,
  slotPrice,
  publishableKey,
  payEnabled,
  fieldClient,
  prefill,
  terms,
  seasonInfo,
}: {
  initialYear: number;
  initialMonth: number;
  initialDays: DaySummary[];
  slotPrice: number;
  publishableKey: string;
  payEnabled: boolean;
  fieldClient: FieldClient;
  prefill?: FieldClient;
  terms: string;
  seasonInfo: { summer: Hours; winter: Hours };
}) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [days, setDays] = useState<DaySummary[]>(initialDays);
  const [activeDay, setActiveDay] = useState<string | null>(null);
  // Multi-day cart: each chosen day maps to its chosen hours.
  const [selection, setSelection] = useState<Record<string, number[]>>({});
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(fieldClient?.name ?? prefill?.name ?? "");
  const [email, setEmail] = useState(fieldClient?.email ?? prefill?.email ?? "");
  const [phone, setPhone] = useState(fieldClient?.phone ?? prefill?.phone ?? "");
  const [carReg, setCarReg] = useState(fieldClient?.carReg ?? prefill?.carReg ?? "");
  // Any logged-in user (field client or a dog-walking client) shouldn't see the
  // "create an account" option — only brand-new guests do.
  const loggedIn = !!fieldClient || !!prefill;
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [saveCard, setSaveCard] = useState(false);

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [payTotal, setPayTotal] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const dayMap = useMemo(() => {
    const m = new Map<string, DaySummary>();
    for (const d of days) m.set(d.dateKey, d);
    return m;
  }, [days]);

  const selectedEntries = useMemo(
    () =>
      Object.entries(selection)
        .filter(([, hrs]) => hrs.length > 0)
        .sort((a, b) => a[0].localeCompare(b[0])),
    [selection]
  );
  const totalSlots = selectedEntries.reduce((n, [, hrs]) => n + hrs.length, 0);
  const subtotal = slotPrice * totalSlots;
  const total = Math.max(0, subtotal - discount);
  const willBeFree = totalSlots > 0 && total < STRIPE_MIN;

  const activeSummary = activeDay ? dayMap.get(activeDay) ?? null : null;
  const activeHours = activeDay ? selection[activeDay] ?? [] : [];

  const reprice = useCallback(
    (nextTotalSlots: number) => {
      if (!couponApplied && !coupon.trim()) return;
      startTransition(async () => {
        const res = await previewPrice(nextTotalSlots || 1, coupon);
        setDiscount(res.discount);
        setCouponApplied(res.couponApplied);
      });
    },
    [coupon, couponApplied]
  );

  const loadMonth = useCallback((y: number, mo: number) => {
    startTransition(async () => {
      const res = await monthView(y, mo);
      setYear(y);
      setMonth(mo);
      setDays(res.days);
      setActiveDay(null);
    });
  }, []);

  const gotoMonth = (delta: number) => {
    let y = year;
    let mo = month + delta;
    if (mo < 1) { mo = 12; y--; }
    if (mo > 12) { mo = 1; y++; }
    loadMonth(y, mo);
  };

  const pickDay = (d: DaySummary) => {
    if (!d.open || d.availableCount === 0) return;
    setActiveDay(d.dateKey);
    setError(null);
  };

  const toggleHour = (h: number) => {
    if (!activeDay) return;
    setSelection((prev) => {
      const cur = prev[activeDay] ?? [];
      const next = cur.includes(h) ? cur.filter((x) => x !== h) : [...cur, h].sort((a, b) => a - b);
      const updated = { ...prev, [activeDay]: next };
      if (next.length === 0) delete updated[activeDay];
      const count = Object.values(updated).reduce((n, hrs) => n + hrs.length, 0);
      reprice(count);
      return updated;
    });
    setError(null);
  };

  const removeDay = (dateKey: string) => {
    setSelection((prev) => {
      const updated = { ...prev };
      delete updated[dateKey];
      const count = Object.values(updated).reduce((n, hrs) => n + hrs.length, 0);
      reprice(count);
      return updated;
    });
  };

  const applyCoupon = useCallback(() => {
    startTransition(async () => {
      const res = await previewPrice(totalSlots || 1, coupon);
      setDiscount(res.discount);
      setCouponApplied(res.couponApplied);
      setCouponMsg(
        coupon.trim()
          ? res.couponApplied
            ? { ok: true, text: `Code applied — you save ${formatMoney(res.discount)}.` }
            : { ok: false, text: res.error ?? "That code isn't valid." }
          : null
      );
    });
  }, [coupon, totalSlots]);

  const phoneOk = phone.replace(/[^0-9]/g, "").length >= 7;
  const carRegOk = carReg.replace(/[^a-zA-Z0-9]/g, "").length >= 2;
  const canSubmit =
    totalSlots > 0 &&
    !!name.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    phoneOk &&
    carRegOk &&
    acceptedTerms &&
    (!createAccount || password.length >= 8) &&
    (willBeFree || payEnabled);

  const beginPayment = async () => {
    setError(null);
    setSubmitting(true);
    const res = await startFieldBooking({
      selection: selectedEntries.map(([dateKey, hours]) => ({ dateKey, hours })),
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      carReg: carReg.trim(),
      acceptedTerms,
      couponCode: coupon.trim() || undefined,
      createAccount: !fieldClient && createAccount,
      password: createAccount ? password : undefined,
      saveCard: (!!fieldClient || createAccount) && saveCard,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      loadMonth(year, month);
      return;
    }
    if (res.free) {
      router.push(`/field/success?ref=${res.reference}`);
      return;
    }
    setReference(res.reference);
    setPayTotal(res.total);
    setClientSecret(res.clientSecret);
  };

  // ---- Payment step -------------------------------------------------------
  if (clientSecret) {
    return (
      <div className="card space-y-4">
        <button
          onClick={() => { setClientSecret(null); setReference(null); }}
          className="text-sm font-semibold text-muted hover:text-brand-dark"
        >
          ← Back to booking
        </button>
        <div>
          <h2 className="text-xl font-bold">Payment</h2>
          <p className="mt-1 text-sm text-muted">
            {totalSlots} slot{totalSlots > 1 ? "s" : ""}
            {selectedEntries.length > 1 ? ` across ${selectedEntries.length} days` : ""} ·{" "}
            <strong>{formatMoney(payTotal)}</strong>
          </p>
        </div>
        <Elements
          stripe={stripePromise(publishableKey)}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: { colorPrimary: "#2ea6d8", borderRadius: "12px", fontFamily: "inherit" },
            },
          }}
        >
          <PayForm
            amount={payTotal}
            reference={reference!}
            onPaid={() => router.push(`/field/success?ref=${reference}`)}
          />
        </Elements>
      </div>
    );
  }

  // ---- Selection step -----------------------------------------------------
  const firstKey = `${year}-${String(month).padStart(2, "0")}-01`;
  const blanks = isoWeekdayOf(firstKey) - 1;

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="card">
        <h2 className="text-xl font-bold">Hire our private playground</h2>
        <p className="mt-1 text-sm text-muted">
          Book secure, exclusive use of the field by the hour — {formatMoney(slotPrice)}{" "}
          per hour. Pick as many hours and days as you like, pay once, and we&apos;ll email your
          gate access codes straight away.
        </p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-brand-soft/60 px-3 py-2">
            <span className="font-semibold text-brand-dark">Summer hours</span>{" "}
            <span className="text-muted">{hhmm(seasonInfo.summer.open)}–{hhmm(seasonInfo.summer.close)} (BST)</span>
          </div>
          <div className="rounded-xl bg-mist px-3 py-2">
            <span className="font-semibold text-brand-dark">Winter hours</span>{" "}
            <span className="text-muted">{hhmm(seasonInfo.winter.open)}–{hhmm(seasonInfo.winter.close)} (GMT)</span>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => gotoMonth(-1)}
            disabled={pending || (year === initialYear && month === initialMonth)}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-soft disabled:opacity-30"
            aria-label="Previous month"
          >‹</button>
          <p className="font-bold">{MONTHS[month - 1]} {year}</p>
          <button
            onClick={() => gotoMonth(1)}
            disabled={pending}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-soft disabled:opacity-30"
            aria-label="Next month"
          >›</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "4px" }}>
          {DOW.map((d) => (
            <div key={d} className="pb-1 text-center text-[0.7rem] font-bold uppercase text-muted">{d}</div>
          ))}
          {Array.from({ length: blanks }).map((_, i) => <div key={`b${i}`} />)}
          {days.map((d) => {
            const dayNum = Number(d.dateKey.slice(-2));
            const selCount = selection[d.dateKey]?.length ?? 0;
            const hasSel = selCount > 0;
            const isActive = activeDay === d.dateKey;
            const bookable = d.open && d.availableCount > 0;
            const full = d.open && d.availableCount === 0;
            let style: React.CSSProperties = {};
            if (hasSel) style = { background: "#2ea6d8", color: "#fff" };
            else if (bookable) style = { background: "#dcfce7", color: "#166534" };
            else if (full) style = { background: "#fee2e2", color: "#b91c1c" };
            if (isActive && !hasSel) style = { ...style, boxShadow: "inset 0 0 0 2px #2ea6d8" };
            return (
              <button
                key={d.dateKey}
                onClick={() => pickDay(d)}
                disabled={!bookable}
                style={style}
                className={`relative aspect-square rounded-lg text-sm font-semibold transition ${
                  bookable ? "hover:opacity-90" : "cursor-default text-muted/50"
                }`}
                title={bookable ? `${d.availableCount} free` : full ? "Fully booked" : "Closed"}
              >
                {dayNum}
                {hasSel && (
                  <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-white px-1 text-[9px] font-bold text-brand">
                    {selCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
          <Legend color="#dcfce7" label="Available" />
          <Legend color="#fee2e2" label="Fully booked" />
          <Legend color="#2ea6d8" label="Selected" />
        </div>
      </div>

      {/* Slots for the active day */}
      {activeSummary && (
        <div className="card">
          <h3 className="font-bold">{prettyDate(activeSummary.dateKey)}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {activeSummary.season === "SUMMER" ? "Summer hours" : "Winter hours"} · tap the hours you&apos;d like
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeSummary.slots.map((s) => {
              const isSel = activeHours.includes(s.hour);
              const disabled = !s.available && !isSel;
              let style: React.CSSProperties = {};
              if (isSel) style = { background: "#2ea6d8", color: "#fff", borderColor: "#2ea6d8" };
              else if (s.available) style = { background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" };
              else style = { background: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" };
              return (
                <button
                  key={s.hour}
                  onClick={() => !disabled && toggleHour(s.hour)}
                  disabled={disabled}
                  style={style}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                    disabled ? "cursor-default line-through opacity-60" : "hover:opacity-90"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-muted">Pick another day on the calendar to add more — it all books together.</p>
        </div>
      )}

      {/* Details + pay */}
      {totalSlots > 0 && (
        <div className="card space-y-4">
          {/* Selected sessions */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-bold">Your sessions</h3>
              <span className="text-sm text-muted">
                {selectedEntries.length} day{selectedEntries.length > 1 ? "s" : ""} · {totalSlots} slot{totalSlots > 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {selectedEntries.map(([dateKey, hrs]) => (
                <div
                  key={dateKey}
                  className="flex items-center gap-3 rounded-xl border border-brand/20 bg-brand-soft/40 px-3 py-2.5"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand shadow-sm">
                    <Icon name="calendar" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-brand-dark">{shortDate(dateKey)}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {hrs.map((h) => (
                        <span
                          key={h}
                          className="rounded-md bg-white px-1.5 py-0.5 text-[0.7rem] font-semibold text-muted"
                        >
                          {slotLabel(h)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-extrabold text-brand-dark">{formatMoney(hrs.length * slotPrice)}</p>
                    <button
                      onClick={() => removeDay(dateKey)}
                      className="mt-0.5 text-xs font-semibold text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <h3 className="font-bold">Your details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Email" required>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={!!fieldClient} />
            </Field>
            <Field label="Phone" required>
              <input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="e.g. 07725 176012" />
            </Field>
            <Field label="Car registration" required>
              <input
                className="input uppercase"
                value={carReg}
                onChange={(e) => setCarReg(e.target.value.toUpperCase())}
                placeholder="e.g. AB12 CDE"
                maxLength={10}
              />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-muted">
            We ask for your car registration so we know who&apos;s using the playground and parking.
          </p>

          {!loggedIn && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} className="mt-0.5" />
              <span><span className="font-semibold">Create an account</span> to see your booking history and book faster next time.</span>
            </label>
          )}
          {!loggedIn && createAccount && (
            <Field label="Choose a password (min 8 characters)" required>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
          )}
          {(fieldClient || createAccount) && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={saveCard} onChange={(e) => setSaveCard(e.target.checked)} />
              <span>Save my card for faster booking next time</span>
            </label>
          )}

          {/* Coupon */}
          <div>
            <label className="mb-1 block text-sm font-medium">Discount code (optional)</label>
            <div className="flex gap-2">
              <input className="input flex-1" value={coupon} onChange={(e) => { setCoupon(e.target.value); setCouponMsg(null); }} placeholder="Enter a code" />
              <button onClick={applyCoupon} disabled={pending || !coupon.trim()} className="btn-outline">Apply</button>
            </div>
            {couponMsg && <p className={`mt-1 text-sm ${couponMsg.ok ? "text-success" : "text-danger"}`}>{couponMsg.text}</p>}
          </div>

          {/* Playground rules / T&Cs */}
          <div>
            <p className="mb-1 text-sm font-semibold">Playground rules &amp; T&amp;Cs</p>
            <div className="max-h-36 overflow-y-auto whitespace-pre-line rounded-xl border border-border bg-mist px-3 py-2 text-sm text-muted">
              {terms}
            </div>
            <label className="mt-2 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I have read and accept the playground rules &amp; terms. <span className="text-danger">*</span>
              </span>
            </label>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-mist px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span>{totalSlots} × 1-hour slot{totalSlots > 1 ? "s" : ""}</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-success"><span>Discount</span><span>−{formatMoney(discount)}</span></div>
            )}
            <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>Total</span>
              <span>{total === 0 ? "Free" : formatMoney(total)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {!payEnabled && !willBeFree && <p className="text-sm text-danger">Online payment isn&apos;t available right now.</p>}

          <button onClick={beginPayment} disabled={!canSubmit || submitting} className="btn-primary w-full py-3 text-base">
            {submitting
              ? "Working…"
              : willBeFree
              ? "Confirm booking"
              : `Pay ${formatMoney(total)} & book`}
          </button>
          <p className="text-center text-xs text-muted">
            {willBeFree
              ? "Nothing to pay — your gate codes are emailed as soon as you confirm."
              : "Card handled securely by Stripe. Your gate codes are emailed the moment payment clears."}
          </p>
        </div>
      )}
    </div>
  );
}

function PayForm({
  amount,
  reference,
  onPaid,
}: {
  amount: number;
  reference: string;
  onPaid: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: `${window.location.origin}/field/success?ref=${reference}` },
    });
    if (err) {
      setError(err.message ?? "We couldn't take that payment. Please try again.");
      setSubmitting(false);
      return;
    }
    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      onPaid();
      return;
    }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={!stripe || submitting} className="btn-primary w-full py-3 text-base">
        {submitting ? "Processing…" : `Pay ${formatMoney(amount)}`}
      </button>
    </form>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label} {required && <span className="text-danger">*</span>}
      </span>
      {children}
    </label>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-3 w-3 rounded" style={{ background: color }} />
      {label}
    </span>
  );
}
