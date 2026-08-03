import { prisma } from "./prisma";
import { getSettings } from "./pricing";

// Load one invoice with everything the branded InvoiceDocument needs. When
// `clientId` is passed it also enforces ownership (for the client-facing view).
export async function loadInvoiceDoc(invoiceId: string, clientId?: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: { orderBy: { date: "asc" } },
      client: { select: { id: true, name: true, email: true, phone: true, address: true } },
    },
  });
  if (!invoice) return null;
  if (clientId && invoice.clientId !== clientId) return null;

  const s = await getSettings();
  return {
    invoice,
    client: {
      name: invoice.client.name,
      email: invoice.client.email,
      phone: invoice.client.phone,
      address: invoice.client.address,
    },
    business: {
      siteName: s.siteName,
      contactEmail: s.contactEmail,
      contactPhone: s.contactPhone,
      address: s.address,
    },
  };
}
