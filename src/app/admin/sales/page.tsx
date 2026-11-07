import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { INVOICE_STATUS, FIELD_BOOKING_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

type Row = { key: string; year: number; month: number; dog: number; events: number; field: number };

export default async function SalesPage() {
  // Dog-walking income = paid invoices; field income = paid field bookings.
  // Event places are billed on the same invoices, so they're pulled out of the
  // line items and counted on their own rather than hidden inside walking.
  // Recognised in the month the payment cleared (paidAt).
  const [invoices, fieldBookings] = await Promise.all([
    prisma.invoice.findMany({
      where: { status: INVOICE_STATUS.PAID, paidAt: { not: null } },
      select: {
        total: true,
        paidAt: true,
        items: { where: { eventSignupId: { not: null } }, select: { amount: true } },
      },
    }),
    prisma.fieldBooking.findMany({
      where: { status: FIELD_BOOKING_STATUS.PAID, paidAt: { not: null } },
      select: { total: true, paidAt: true },
    }),
  ]);

  const rows = new Map<string, Row>();
  const bucket = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const key = `${y}-${String(m).padStart(2, "0")}`;
    if (!rows.has(key)) rows.set(key, { key, year: y, month: m, dog: 0, events: 0, field: 0 });
    return rows.get(key)!;
  };
  const eventShare = (i: { items: { amount: number }[] }) =>
    i.items.reduce((n, it) => n + it.amount, 0);
  for (const i of invoices) {
    const events = eventShare(i);
    const row = bucket(i.paidAt!);
    row.events += events;
    row.dog += i.total - events; // walks only
  }
  for (const b of fieldBookings) bucket(b.paidAt!).field += b.total;

  const ordered = [...rows.values()].sort((a, b) => b.key.localeCompare(a.key));
  const totalEvents = invoices.reduce((s, i) => s + eventShare(i), 0);
  const totalDog = invoices.reduce((s, i) => s + i.total, 0) - totalEvents;
  const totalField = fieldBookings.reduce((s, b) => s + b.total, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Sales</h1>
        <p className="text-muted">Monthly income - dog walking, events and field hire, side by side.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Dog walking" value={totalDog} tone="brand" />
        <Stat label="Events" value={totalEvents} tone="warn" />
        <Stat label="Field hire" value={totalField} tone="success" />
        <Stat label="Combined" value={totalDog + totalEvents + totalField} tone="dark" />
      </div>

      <div className="card overflow-x-auto">
        {ordered.length === 0 ? (
          <p className="text-sm text-muted">No paid income yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-4 font-semibold">Month</th>
                <th className="py-2 pr-4 text-right font-semibold">Dog walking</th>
                <th className="py-2 pr-4 text-right font-semibold">Events</th>
                <th className="py-2 pr-4 text-right font-semibold">Field hire</th>
                <th className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((r) => (
                <tr key={r.key} className="border-b border-border/60">
                  <td className="py-2 pr-4 font-medium">{MONTHS[r.month]} {r.year}</td>
                  <td className="py-2 pr-4 text-right">{formatMoney(r.dog)}</td>
                  <td className="py-2 pr-4 text-right">{formatMoney(r.events)}</td>
                  <td className="py-2 pr-4 text-right">{formatMoney(r.field)}</td>
                  <td className="py-2 text-right font-bold">{formatMoney(r.dog + r.events + r.field)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "brand" | "warn" | "success" | "dark";
}) {
  const cls =
    tone === "brand" ? "bg-brand-soft/60 text-brand-dark"
      : tone === "warn" ? "bg-warn/15 text-warn"
      : tone === "success" ? "bg-success/10 text-success"
      : "bg-charcoal text-white";
  return (
    <div className={`rounded-xl px-4 py-3 ${cls}`}>
      <p className="text-xs font-semibold uppercase opacity-80">{label}</p>
      <p className="text-xl font-extrabold">{formatMoney(value)}</p>
    </div>
  );
}
