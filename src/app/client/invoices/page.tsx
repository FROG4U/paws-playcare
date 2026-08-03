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

export default async function ClientInvoicesPage() {
  const user = await requireClient();

  const invoices = await prisma.invoice.findMany({
    where: { clientId: user.id },
    include: { items: { orderBy: { date: "asc" } } },
    orderBy: { periodEnd: "desc" },
  });

  const accruing = invoices.filter(
    (i) => i.status === INVOICE_STATUS.OPEN && !i.dueAt
  );
  const awaiting = invoices.filter(
    (i) => i.status === INVOICE_STATUS.OPEN && i.dueAt
  );
  const history = invoices.filter(
    (i) => i.status === INVOICE_STATUS.PAID || i.status === INVOICE_STATUS.FAILED
  );

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
            <span className="font-bold">No card on file.</span> Add a card so we
            can collect payment automatically.{" "}
            <a href="/client/payment" className="font-bold underline">
              Add card →
            </a>
          </p>
        </div>
      )}

      {invoices.length === 0 && (
        <EmptyState icon="receipt" title="Nothing owed yet">
          Once a walk is completed it&apos;ll show here with what you owe and when
          payment is due.
        </EmptyState>
      )}

      {/* Current period — still adding up */}
      {accruing.map((inv) => (
        <InvoiceCard
          key={inv.id}
          tone="current"
          heading="This period"
          sub={periodLabel(inv.cadence, { start: inv.periodStart, end: inv.periodEnd })}
          total={inv.total}
          dueLabel={`Payment due ${formatDate(inv.periodEnd)}`}
          items={inv.items}
        />
      ))}

      {/* Issued — final invoice sent, awaiting the charge */}
      {awaiting.map((inv) => (
        <InvoiceCard
          key={inv.id}
          tone="awaiting"
          heading={`Invoice ${inv.number}`}
          sub={periodLabel(inv.cadence, { start: inv.periodStart, end: inv.periodEnd })}
          total={inv.total}
          dueLabel={inv.dueAt ? `Payment due ${formatDate(inv.dueAt)}` : "Awaiting payment"}
          items={inv.items}
          href={`/client/invoices/${inv.id}`}
        />
      ))}

      {/* Past invoices */}
      {history.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon name="clock" className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-bold">History</h2>
          </div>
          {history.map((inv) => (
            <InvoiceCard
              key={inv.id}
              tone={inv.status === INVOICE_STATUS.PAID ? "paid" : "failed"}
              heading={`Invoice ${inv.number}`}
              sub={periodLabel(inv.cadence, { start: inv.periodStart, end: inv.periodEnd })}
              total={inv.total}
              dueLabel={
                inv.status === INVOICE_STATUS.PAID
                  ? `Paid${inv.paidAt ? ` ${formatDate(inv.paidAt)}` : ""}`
                  : inv.failureReason || "Payment failed — we'll retry."
              }
              items={inv.items}
              href={`/client/invoices/${inv.id}`}
            />
          ))}
        </section>
      )}
    </div>
  );
}

type Tone = "current" | "awaiting" | "paid" | "failed";

const TONE_BADGE: Record<Tone, { label: string; cls: string }> = {
  current: { label: "Adding up", cls: "bg-brand-soft text-brand-dark" },
  awaiting: { label: "Due soon", cls: "bg-warn/15 text-warn" },
  paid: { label: "Paid", cls: "bg-success/15 text-success" },
  failed: { label: "Failed", cls: "bg-danger/10 text-danger" },
};

function InvoiceCard({
  tone,
  heading,
  sub,
  total,
  dueLabel,
  items,
  href,
}: {
  tone: Tone;
  heading: string;
  sub: string;
  total: number;
  dueLabel: string;
  items: { id: string; description: string; amount: number }[];
  href?: string;
}) {
  const badge = TONE_BADGE[tone];
  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-bold">{heading}</h3>
          <p className="text-sm text-muted">{sub}</p>
        </div>
        <span className={`badge ${badge.cls}`}>{badge.label}</span>
      </div>

      <ul className="divide-y divide-border">
        {items.map((it) => (
          <li key={it.id} className="flex items-center justify-between py-2 text-sm">
            <span>{it.description}</span>
            <span className="font-medium">{formatMoney(it.amount)}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <div>
          <p className="text-lg font-extrabold">{formatMoney(total)}</p>
          <p className="text-sm text-muted">{dueLabel}</p>
        </div>
        {href && (
          <a href={href} className="btn-outline text-sm">
            <Icon name="receipt" className="h-4 w-4" />
            View / download
          </a>
        )}
      </div>
    </div>
  );
}
