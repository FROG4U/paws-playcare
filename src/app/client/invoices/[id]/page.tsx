import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClient } from "@/lib/guard";
import { loadInvoiceDoc } from "@/lib/invoice-view";
import { InvoiceDocument } from "@/components/InvoiceDocument";
import { PrintButton } from "@/components/PrintButton";
import { Icon } from "@/components/Icon";

export default async function ClientInvoiceView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;
  const data = await loadInvoiceDoc(id, user.id); // ownership-checked
  if (!data) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <Link href="/client/invoices" className="flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-dark">
          <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
          My invoices
        </Link>
        <div className="flex items-center gap-2">
          <a href={`/client/invoices/${id}/pdf`} className="btn-primary text-sm" download>
            <Icon name="receipt" className="h-4 w-4" />
            Download PDF
          </a>
          <PrintButton />
        </div>
      </div>

      <InvoiceDocument invoice={data.invoice} client={data.client} business={data.business} />
    </div>
  );
}
