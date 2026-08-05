import { requireClient } from "@/lib/guard";
import { loadInvoiceDoc } from "@/lib/invoice-view";
import { invoicePdfBuffer } from "@/lib/invoice-pdf";

// Streams the invoice as a downloadable PDF (client-owned invoices only).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireClient();
  const { id } = await params;
  const data = await loadInvoiceDoc(id, user.id);
  if (!data) return new Response("Not found", { status: 404 });

  const pdf = await invoicePdfBuffer(data);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Invoice-${data.invoice.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
