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

function isoWeekdayOf(dateKey: string): number {
  const wd = new Date(dateKey + "T00:00:00.000Z").getUTCDay();
  return wd === 0 ? 7 : wd; // Mon=1 … Sun=7
}
function prettyDate(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00.000Z");
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
  });
}

type FieldClient = { name: string; email: string } | null;
type Hours = { open: number; close: number };

export function FieldBooking({
  initialYear,
  initialMonth,
  initialDays,
  slotPrice,
  publishableKey,
  payEnabled,
  fieldClient,
  seasonInfo,
}: {
  initialYear: number;
  initialMonth: number;
  initialDays: DaySummary[];
  slotPrice: number;
  publishableKey: string;
  payEnabled: boolean;
  fieldClient: FieldClient;
  seasonInfo: { summer: Hours; winter: Hours };
}) {
  const router = useRouter();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [days, setDays] = useState<DaySummary[]>(initialDays);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedHours, setSelectedHours] = useState<number[]>([]);
  const [pending, startTransition] = useTransition();

  // Contact / account
  const [name, setName] = useState(fieldClient?.name ?? "");
  const [email, setEmail] = useState(fieldClient?.email ?? "");
  const [phone, setPhone] = useState("");
  const [createAccount, setCreateAccount] = useState(false);
  const [password, setPassword] = useState("");
  const [saveCard, setSaveCard] = useState(false);

  // Coupon + price
  const [coupon, setCoupon] = useState("");
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [discount, setDiscount] = useState(0);
  const [couponApplied, setCouponApplied] = useState(false);

  // Payment
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dayMap = useMemo(() => {
    const m = new Map<string, DaySummary>();
    for (const d of days) m.set(d.dateKey, d);
    return m;
  }, [days]);

  const selected = selectedDay ? dayMap.get(selectedDay) ?? null : null;
  const subtotal = slotPrice * selectedHours.length;
  const total = Math.max(0, subtotal - discount);

  const loadMonth = useCallback((y: number, mo: number) => {
    startTransition(async () => {
      const res = await monthView(y, mo);
      setYear(y);
      setMonth(mo);
      setDays(res.days);
      setSelectedDay(null);
      setSelectedHours([]);
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
    setSelectedDay(d.dateKey);
    setSelectedHours([]);
    setError(null);
  };

  const toggleHour = (h: number) => {
    setSelectedHours((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h].sort((a, b) => a - b)
    );
    // Re-apply coupon against the new count if one is active.
    if (couponApplied) applyCoupon();
    setError(null);
  };

  const applyCoupon = useCallback(() => {
    const count = selectedHours.length || 1;
    startTransition(async () => {
      const res = await previewPrice(count, coupon);
      setDiscount(res.discount);
      setCouponApplied(res.couponApplied);
      if (coupon.trim()) {
        setCouponMsg(
          res.couponApplied
            ? { ok: true, text: `Code applied — you save ${formatMoney(res.discount)}.` }
            : { ok: false, text: res.error ?? "That code isn't valid." }
        );
      } else {
        setCouponMsg(null);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coupon, selectedHours.length]);

  const canPay =
    payEnabled &&
    !!selectedDay &&
    selectedHours.length > 0 &&
    name.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) &&
    (!createAccount || password.length >= 8);

  const beginPayment = async () => {
    setError(null);
    setSubmitting(true);
    const res = await startFieldBooking({
      dateKey: selectedDay!,
      hours: selectedHours,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || undefined,
      couponCode: coupon.trim() || undefined,
      createAccount: !fieldClient && createAccount,
      password: createAccount ? password : undefined,
      saveCard: (!!fieldClient || createAccount) && saveCard,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      // Availability may have changed — refresh this month.
      loadMonth(year, month);
      return;
    }
    setReference(res.reference);
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
            {selectedHours.length} slot{selectedHours.length > 1 ? "s" : ""} on{" "}
            {prettyDate(selectedDay!)} · <strong>{formatMoney(total)}</strong>
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
            amount={total}
            reference={reference!}
            onPaid={() => router.push(`/field/success?ref=${reference}`)}
          />
        </Elements>
      </div>
    );
  }

  // ---- Selection step -----------------------------------------------------
  const leading = selected ? 0 : 0; // (unused; grid computed below)
  void leading;
  const firstKey = `${year}-${String(month).padStart(2, "0")}-01`;
  const blanks = isoWeekdayOf(firstKey) - 1;

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="card">
        <h2 className="text-xl font-bold">Hire our private playground</h2>
        <p className="mt-1 text-sm text-muted">
          Book secure, exclusive use of the field by the hour — {formatMoney(slotPrice)}{" "}
          per hour. Pay online and we&apos;ll email your gate access codes straight away.
        </p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl bg-brand-soft/60 px-3 py-2">
            <span className="font-semibold text-brand-dark">Summer hours</span>{" "}
            <span className="text-muted">
              {hhmm(seasonInfo.summer.open)}–{hhmm(seasonInfo.summer.close)} (BST)
            </span>
          </div>
          <div className="rounded-xl bg-mist px-3 py-2">
            <span className="font-semibold text-brand-dark">Winter hours</span>{" "}
            <span className="text-muted">
              {hhmm(seasonInfo.winter.open)}–{hhmm(seasonInfo.winter.close)} (GMT)
            </span>
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
          >
            ‹
          </button>
          <p className="font-bold">{MONTHS[month - 1]} {year}</p>
          <button
            onClick={() => gotoMonth(1)}
            disabled={pending}
            className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-soft disabled:opacity-30"
            aria-label="Next month"
          >
            ›
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "4px" }}>
          {DOW.map((d) => (
            <div key={d} className="pb-1 text-center text-[0.7rem] font-bold uppercase text-muted">
              {d}
            </div>
          ))}
          {Array.from({ length: blanks }).map((_, i) => <div key={`b${i}`} />)}
          {days.map((d) => {
            const dayNum = Number(d.dateKey.slice(-2));
            const isSel = selectedDay === d.dateKey;
            const bookable = d.open && d.availableCount > 0;
            const full = d.open && d.availableCount === 0;
            let style: React.CSSProperties = {};
            if (isSel) style = { background: "#2ea6d8", color: "#fff" };
            else if (bookable) style = { background: "#dcfce7", color: "#166534" };
            else if (full) style = { background: "#fee2e2", color: "#b91c1c" };
            return (
              <button
                key={d.dateKey}
                onClick={() => pickDay(d)}
                disabled={!bookable}
                style={style}
                className={`aspect-square rounded-lg text-sm font-semibold transition ${
                  bookable || isSel ? "hover:opacity-90" : "cursor-default text-muted/50"
                }`}
                title={
                  bookable ? `${d.availableCount} slot${d.availableCount > 1 ? "s" : ""} free`
                    : full ? "Fully booked" : "Closed"
                }
              >
                {dayNum}
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

      {/* Slots for the selected day */}
      {selected && (
        <div className="card">
          <h3 className="font-bold">{prettyDate(selected.dateKey)}</h3>
          <p className="mt-0.5 text-sm text-muted">
            {selected.season === "SUMMER" ? "Summer hours" : "Winter hours"} · tap the hours you&apos;d like
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {selected.slots.map((s) => {
              const isSel = selectedHours.includes(s.hour);
              const disabled = !s.available;
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
                  title={s.blocked ? "Unavailable" : s.past ? "Passed" : s.available ? "Available" : "Booked"}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Details + pay */}
      {selectedHours.length > 0 && (
        <div className="card space-y-4">
          <h3 className="font-bold">Your details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" required>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Email" required>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" disabled={!!fieldClient} />
            </Field>
            <Field label="Phone (optional)">
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </Field>
          </div>

          {!fieldClient && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={createAccount} onChange={(e) => setCreateAccount(e.target.checked)} className="mt-0.5" />
              <span>
                <span className="font-semibold">Create an account</span> to see your booking history and
                book faster next time.
              </span>
            </label>
          )}
          {!fieldClient && createAccount && (
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
              <input
                className="input flex-1"
                value={coupon}
                onChange={(e) => { setCoupon(e.target.value); setCouponMsg(null); }}
                placeholder="Enter a code"
              />
              <button onClick={applyCoupon} disabled={pending || !coupon.trim()} className="btn-outline">
                Apply
              </button>
            </div>
            {couponMsg && (
              <p className={`mt-1 text-sm ${couponMsg.ok ? "text-success" : "text-danger"}`}>
                {couponMsg.text}
              </p>
            )}
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-mist px-4 py-3 text-sm">
            <div className="flex justify-between">
              <span>{selectedHours.length} × 1-hour slot</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-success">
                <span>Discount</span>
                <span>−{formatMoney(discount)}</span>
              </div>
            )}
            <div className="mt-1 flex justify-between border-t border-border pt-2 text-base font-bold">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {!payEnabled && (
            <p className="text-sm text-danger">Online payment isn&apos;t available right now.</p>
          )}

          <button onClick={beginPayment} disabled={!canPay || submitting} className="btn-primary w-full py-3 text-base">
            {submitting ? "Starting…" : `Pay ${formatMoney(total)} & book`}
          </button>
          <p className="text-center text-xs text-muted">
            Card handled securely by Stripe. Your gate codes are emailed the moment payment clears.
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
      confirmParams: {
        return_url: `${window.location.origin}/field/success?ref=${reference}`,
      },
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

function hhmm(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}
