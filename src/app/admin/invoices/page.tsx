import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { INVOICE_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHeader, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  PAID: { label: "Paid", cls: "bg-success/15 text-success" },
  OPEN: { label: "Open", cls: "bg-warn/15 text-warn" },
  FAILED: { label: "Failed", cls: "bg-danger/10 text-danger" },
  VOID: { label: "Void", cls: "bg-border text-muted" },
};

export default async function AdminInvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: {
      client: { select: { name: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const paidTotal = invoices
    .filter((i) => i.status === INVOICE_STATUS.PAID)
    .reduce((s, i) => s + i.total, 0);
  const outstandingTotal = invoices
    .filter((i) => i.status === INVOICE_STATUS.OPEN || i.status === INVOICE_STATUS.FAILED)
    .reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-5">
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
        <div className="grid gap-2">
          {invoices.map((inv) => {
            const badge = STATUS_BADGE[inv.status] ?? { label: inv.status, cls: "bg-border text-muted" };
            return (
              <Link
                key={inv.id}
                href={`/admin/invoices/${inv.id}`}
                className="card flex flex-wrap items-center justify-between gap-3 transition hover:border-brand/30 hover:shadow-md"
              >
                <div>
                  <p className="font-bold">
                    {inv.client.name}
                    <span className={`ml-2 badge ${badge.cls}`}>{badge.label}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {inv.number} · {formatDate(inv.createdAt)} · {inv._count.items} walk
                    {inv._count.items !== 1 ? "s" : ""} · {inv.cadence.toLowerCase()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">{formatMoney(inv.total)}</span>
                  <Icon name="chevronRight" className="h-4 w-4 text-muted" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
