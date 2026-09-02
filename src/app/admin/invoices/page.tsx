import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { INVOICE_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHeader, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { PaidMonthPicker } from "./PaidMonthPicker";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PAID: { label: "Paid", cls: "bg-success/15 text-success" },
  OPEN: { label: "Open", cls: "bg-warn/15 text-warn" },
  FAILED: { label: "Failed", cls: "bg-danger/10 text-danger" },
  VOID: { label: "Void", cls: "bg-border text-muted" },
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

type InvoiceRow = {
  id: string;
  number: string;
  status: string;
  total: number;
  cadence: string;
  createdAt: Date;
  paidAt: Date | null;
  client: { name: string };
  _count: { items: number };
};

function InvoiceCard({ inv }: { inv: InvoiceRow }) {
  const badge = STATUS_BADGE[inv.status] ?? { label: inv.status, cls: "bg-border text-muted" };
  return (
    <Link
      href={`/admin/invoices/${inv.id}`}
      className="card flex flex-wrap items-center justify-between gap-3 transition hover:border-brand/30 hover:shadow-md"
    >
      <div>
        <p className="font-bold">
          {inv.client.name}
          <span className={`ml-2 badge ${badge.cls}`}>{badge.label}</span>
        </p>
        <p className="text-sm text-muted">
          {inv.number} · {formatDate(inv.paidAt ?? inv.createdAt)} · {inv._count.items} walk
          {inv._count.items !== 1 ? "s" : ""} · {inv.cadence.toLowerCase()}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold">{formatMoney(inv.total)}</span>
        <Icon name="chevronRight" className="h-4 w-4 text-muted" />
      </div>
    </Link>
  );
}

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const invoices = (await prisma.invoice.findMany({
    include: {
      client: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  })) as InvoiceRow[];

  const paidTotal = invoices
    .filter((i) => i.status === INVOICE_STATUS.PAID)
    .reduce((s, i) => s + i.total, 0);
  const outstandingTotal = invoices
    .filter((i) => i.status === INVOICE_STATUS.OPEN || i.status === INVOICE_STATUS.FAILED)
    .reduce((s, i) => s + i.total, 0);

  // Active list = anything not yet paid (needs attention), newest first.
  const active = invoices.filter((i) => i.status !== INVOICE_STATUS.PAID);
  const paid = invoices.filter((i) => i.status === INVOICE_STATUS.PAID);

  // Group paid invoices into months (by when they were paid), for the archive
  // dropdown. Keys are "YYYY-MM"; the map preserves newest-first order because
  // the invoices are already sorted that way.
  const monthKeyOf = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const byMonth = new Map<string, InvoiceRow[]>();
  for (const inv of paid) {
    const k = monthKeyOf(inv.paidAt ?? inv.createdAt);
    if (!byMonth.has(k)) byMonth.set(k, []);
    byMonth.get(k)!.push(inv);
  }
  const months = [...byMonth.entries()].map(([key, list]) => {
    const [y, mo] = key.split("-");
    return { key, label: `${MONTH_NAMES[Number(mo) - 1]} ${y}`, count: list.length };
  });
  // Selected month: the one from the URL if it has paid invoices, else the most
  // recent month available.
  const selectedMonth =
    m && byMonth.has(m) ? m : months[0]?.key ?? "";
  const monthList = selectedMonth ? byMonth.get(selectedMonth) ?? [] : [];
  const monthTotal = monthList.reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="receipt"
        title="Invoices"
        subtitle={`${invoices.length} invoice${invoices.length !== 1 ? "s" : ""} · ${formatMoney(paidTotal)} paid · ${formatMoney(outstandingTotal)} outstanding`}
      />

      {invoices.length === 0 ? (
        <EmptyState icon="receipt" title="No invoices yet">
          Invoices are created automatically as walks are completed, grouped by
          each client&apos;s billing cadence.
        </EmptyState>
      ) : (
        <>
          {/* Outstanding / needs attention */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon name="clock" className="h-5 w-5 text-warn" />
              <h2 className="text-lg font-bold">Outstanding</h2>
              <span className="badge bg-mist text-muted">{active.length}</span>
            </div>
            {active.length === 0 ? (
              <p className="card text-sm text-muted">Nothing outstanding — every invoice is paid.</p>
            ) : (
              <div className="grid gap-2">
                {active.map((inv) => (
                  <InvoiceCard key={inv.id} inv={inv} />
                ))}
              </div>
            )}
          </section>

          {/* Paid archive, filtered by month */}
          {paid.length > 0 && (
            <section id="paid" className="space-y-2 scroll-mt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Icon name="check" className="h-5 w-5 text-success" />
                  <h2 className="text-lg font-bold">Paid archive</h2>
                  <span className="badge bg-mist text-muted">{paid.length}</span>
                </div>
                <PaidMonthPicker months={months} selected={selectedMonth} />
              </div>
              <p className="text-sm text-muted">
                {monthList.length} invoice{monthList.length !== 1 ? "s" : ""} · {formatMoney(monthTotal)} this month
              </p>
              <div className="grid gap-2">
                {monthList.map((inv) => (
                  <InvoiceCard key={inv.id} inv={inv} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
