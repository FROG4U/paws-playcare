import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { periodLabel } from "@/lib/billing";
import { INVOICE_STATUS } from "@/lib/constants";

export type InvoiceDoc = {
  number: string;
  cadence: string;
  status: string;
  periodStart: Date;
  periodEnd: Date;
  total: number;
  subtotal: number;
  dueAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  items: { id: string; description: string; date: Date; amount: number }[];
};

export type InvoiceParty = {
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export type InvoiceBusiness = {
  siteName: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
};

const STATUS_STYLE: Record<string, string> = {
  PAID: "bg-success/15 text-success",
  OPEN: "bg-warn/15 text-warn",
  FAILED: "bg-danger/10 text-danger",
  VOID: "bg-border text-muted",
};

export function InvoiceDocument({
  invoice,
  client,
  business,
}: {
  invoice: InvoiceDoc;
  client: InvoiceParty;
  business: InvoiceBusiness;
}) {
  const statusLabel =
    invoice.status === INVOICE_STATUS.PAID
      ? "Paid"
      : invoice.status === INVOICE_STATUS.OPEN
        ? invoice.dueAt
          ? "Due"
          : "Draft"
        : invoice.status.charAt(0) + invoice.status.slice(1).toLowerCase();

  return (
    <div className="invoice-print mx-auto max-w-2xl rounded-2xl border border-border bg-white p-8 text-foreground shadow-sm print:border-0 print:shadow-none">
      {/* Header: brand + invoice meta */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo.webp" alt={business.siteName} className="h-14 w-auto" />
        </div>
        <div className="text-right">
          <h1 className="text-2xl font-extrabold tracking-tight text-brand">INVOICE</h1>
          <p className="mt-1 text-sm">
            <span className="text-muted">No.</span> {invoice.number}
          </p>
          <p className="text-sm">
            <span className="text-muted">Issued</span> {formatDate(invoice.createdAt)}
          </p>
          <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[invoice.status] ?? "bg-border text-muted"}`}>
            {statusLabel}
          </span>
        </div>
      </div>

      {/* From / To */}
      <div className="grid gap-6 py-6 sm:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">From</p>
          <p className="mt-1 font-bold">{business.siteName}</p>
          {business.address && <p className="text-sm text-muted">{business.address}</p>}
          {business.contactEmail && <p className="text-sm text-muted">{business.contactEmail}</p>}
          {business.contactPhone && <p className="text-sm text-muted">{business.contactPhone}</p>}
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">Bill to</p>
          <p className="mt-1 font-bold">{client.name}</p>
          {client.address && <p className="text-sm text-muted">{client.address}</p>}
          {client.email && <p className="text-sm text-muted">{client.email}</p>}
          {client.phone && <p className="text-sm text-muted">{client.phone}</p>}
        </div>
      </div>

      {/* Period */}
      <p className="rounded-lg bg-brand-soft px-3 py-2 text-sm font-medium text-brand-dark">
        Walks for {periodLabel(invoice.cadence, { start: invoice.periodStart, end: invoice.periodEnd })}
      </p>

      {/* Line items */}
      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="py-2 font-semibold">Description</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((it) => (
            <tr key={it.id} className="border-b border-border/70">
              <td className="py-2.5">{it.description}</td>
              <td className="py-2.5 text-right font-medium">{formatMoney(it.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-4 text-right font-bold">Total</td>
            <td className="pt-4 text-right text-xl font-extrabold text-brand">{formatMoney(invoice.total)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Payment line */}
      <p className="mt-4 text-sm text-muted">
        {invoice.status === INVOICE_STATUS.PAID
          ? `Paid${invoice.paidAt ? ` on ${formatDate(invoice.paidAt)}` : ""} — thank you.`
          : invoice.dueAt
            ? `Payment of ${formatMoney(invoice.total)} will be taken automatically from your card on file on ${formatDate(invoice.dueAt)}.`
            : "This invoice is still adding up as walks are completed."}
      </p>

      {/* Thank you */}
      <div className="mt-6 rounded-xl bg-brand-soft/60 px-4 py-4 text-center">
        <p className="font-bold text-brand-dark">Thank you for choosing {business.siteName}! 🐾</p>
        <p className="text-sm text-muted">We loved spending time with your dog.</p>
      </div>

      {/* Footer */}
      <p className="mt-6 border-t border-border pt-4 text-center text-xs text-muted">
        {business.siteName}
        {business.contactEmail ? ` · ${business.contactEmail}` : ""}
        {business.contactPhone ? ` · ${business.contactPhone}` : ""}
      </p>
    </div>
  );
}
