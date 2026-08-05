import { requireClient } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { INVOICE_STATUS, PAY_CADENCE } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { periodLabel } from "@/lib/billing";
import { PageHeader, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";

const CADENCE_BLURB: Record<string, string> = {
  [PAY_CADENCE.DAILY]: "You're billed daily — each evening for that day's walks.",
  [PAY_CADENCE.WEEKLY]: "You're billed weekly — every Friday for that week's walks.",
  [PAY_CADENCE.MONTHLY]: "You're billed monthly — on the last day of the month.",
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function ClientInvoicesPage() {
  const user = await requireClient();

  const invoices = await prisma.invoice.findMany({
    where: { clientId: user.id },
    include: { items: { orderBy: { date: "asc" } } },
    orderBy: { periodEnd: "desc" },
  });

  const accruing = invoices.filter((i) => i.status === INVOICE_STATUS.OPEN && !i.dueAt);
  const finalized = invoices.filter((i) => !(i.status === INVOICE_STATUS.OPEN && !i.dueAt));

  // Group finalized invoices by the month of their billing period (newest first —
  // the query is already ordered by periodEnd desc, so months come out in order).
  const months: { key: string; label: string; invoices: typeof finalized }[] = [];
  for (const inv of finalized) {
    const key = `${inv.periodEnd.getUTCFullYear()}-${inv.periodEnd.getUTCMonth()}`;
    let group = months.find((m) => m.key === key);
    if (!group) {
      group = { key, label: `${MONTHS[inv.periodEnd.getUTCMonth()]} ${inv.periodEnd.getUTCFullYear()}`, invoices: [] };
      months.push(group);
    }
    group.invoices.push(inv);
  }

  const hasCard = !!user.paymentMethodId;

  return (
    <div className="space-y-6">
      <PageHeader
        icon="receipt"
        title="Payments & invoices"
        subtitle={CADENCE_BLURB[user.payCadence] ?? "Your walk invoices appear here."}
      />

      {!hasCard && (
        <div className="flex items-start gap-3 rounded-xl bg-brand-soft p-4 text-brand-dark">
          <Icon name="card" className="mt-0.5 h-5 w-5 shrink-0" />
          <p className="text-sm">
            <span className="font-bold">No card on file.</span> Add a card so we can collect payment automatically.{" "}
            <a href="/client/payment" className="font-bold underline">Add card →</a>
          </p>
        </div>
      )}

      {invoices.length === 0 && (
        <EmptyState icon="receipt" title="Nothing owed yet">
          Once a walk is completed it&apos;ll show here with what you owe and when payment is due.
        </EmptyState>
      )}

      {/* Current period — still adding up (no PDF yet) */}
      {accruing.map((inv) => (
        <div key={inv.id} className="card space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="font-bold">This period</h3>
              <p className="text-sm text-muted">{periodLabel(inv.cadence, { start: inv.periodStart, end: inv.periodEnd })}</p>
            </div>
            <span className="badge bg-brand-soft text-brand-dark">Adding up</span>
          </div>
          <ul className="divide-y divide-border">
            {inv.items.map((it) => (
              <li key={it.id} className="flex items-center justify-between py-2 text-sm">
                <span>{it.description}</span>
                <span className="font-medium">{formatMoney(it.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-border pt-3">
            <p className="text-lg font-extrabold">{formatMoney(inv.total)}</p>
            <p className="text-sm text-muted">Payment due {formatDate(inv.periodEnd)}</p>
          </div>
        </div>
      ))}

      {/* Finalized invoices, grouped by month, each downloadable as a PDF */}
      {months.map((m) => (
        <section key={m.key} className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{m.label}</h2>
          <div className="space-y-2">
            {m.invoices.map((inv) => {
              const paid = inv.status === INVOICE_STATUS.PAID;
              const failed = inv.status === INVOICE_STATUS.FAILED;
              const badge = paid
                ? { label: "Paid", cls: "bg-success/15 text-success" }
                : failed
                  ? { label: "Failed", cls: "bg-danger/10 text-danger" }
                  : { label: "Due soon", cls: "bg-warn/15 text-warn" };
              return (
                <div key={inv.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{inv.number}</p>
                    <p className="text-sm text-muted">
                      {periodLabel(inv.cadence, { start: inv.periodStart, end: inv.periodEnd })} · {formatMoney(inv.total)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge ${badge.cls}`}>{badge.label}</span>
                    <a href={`/client/invoices/${inv.id}`} className="btn-ghost text-sm">View</a>
                    <a href={`/client/invoices/${inv.id}/pdf`} className="btn-primary text-sm" download>
                      <Icon name="receipt" className="h-4 w-4" />
                      PDF
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
