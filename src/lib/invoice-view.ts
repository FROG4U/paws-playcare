import { prisma } from "./prisma";
import { getSettings } from "./pricing";
import { getServices } from "./services";
import { invoiceLineForWalk } from "./billing";
import { serviceColorMap } from "./service-colors";

// Load one invoice with everything the branded InvoiceDocument needs. When
// `clientId` is passed it also enforces ownership (for the client-facing view).
//
// Each line's description and service colour are recomputed from the walk at
// load time, so invoices always show current dog names (fixing older items whose
// stored text still reads "1 dog") and a colour dot for the service.
export async function loadInvoiceDoc(invoiceId: string, clientId?: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: {
        orderBy: { date: "asc" },
        include: {
          walk: {
            select: {
              serviceName: true,
              date: true,
              numDogs: true,
              lateCancelled: true,
              isExtra: true,
              booking: { select: { dogIds: true } },
            },
          },
        },
      },
      client: { select: { id: true, name: true, email: true, phone: true, address: true } },
    },
  });
  if (!invoice) return null;
  if (clientId && invoice.clientId !== clientId) return null;

  const [s, colorMap] = await Promise.all([
    getSettings(),
    getServices().then(serviceColorMap),
  ]);

  const items = await Promise.all(
    invoice.items.map(async (it) => {
      let description = it.description;
      try {
        if (it.walk) {
          const line = await invoiceLineForWalk(it.walk);
          if (line && line.trim()) description = line;
        }
      } catch {
        // keep the stored description on any failure
      }
      return {
        id: it.id,
        description,
        date: it.date,
        amount: it.amount,
        colorIndex: it.walk?.serviceName != null ? colorMap[it.walk.serviceName] ?? null : null,
      };
    })
  );

  return {
    invoice: { ...invoice, items },
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
