// One-off: apply the multi-dog rate (£14/dog for 2+ dogs) to EXISTING data.
// Run once on the server after deploying:  npm run reprice-multidog
//
// - Upcoming walks (not completed/cancelled) with 2+ dogs → £14 × dogs.
// - Completed 2+ dog walks that sit on an invoice NOT yet paid → repriced on
//   both the walk and the invoice line, and the invoice total recomputed.
//   Already-paid invoices are left untouched (money already collected).
// No-charge walks are skipped.

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const MIN_DOGS = 2;
const RATE = 1400; // £14.00

// 1) Upcoming / open walks.
const upcoming = await prisma.walk.findMany({
  where: {
    status: { in: ["REQUESTED", "ASSIGNED", "ACCEPTED"] },
    numDogs: { gte: MIN_DOGS },
    noCharge: false,
  },
  select: { id: true, numDogs: true, price: true },
});
let walksRepriced = 0;
for (const w of upcoming) {
  const newPrice = RATE * w.numDogs;
  if (w.price !== newPrice) {
    await prisma.walk.update({ where: { id: w.id }, data: { price: newPrice } });
    walksRepriced++;
  }
}

// 2) Invoiced (but not yet paid) completed walks.
const items = await prisma.invoiceItem.findMany({
  where: { walk: { numDogs: { gte: MIN_DOGS }, noCharge: false } },
  include: { walk: { select: { id: true, numDogs: true } }, invoice: true },
});
let itemsRepriced = 0;
const touched = new Set();
for (const it of items) {
  if (it.invoice.status === "PAID" || it.invoice.paidAt) continue;
  const newPrice = RATE * it.walk.numDogs;
  if (it.amount === newPrice) continue;
  await prisma.walk.update({ where: { id: it.walk.id }, data: { price: newPrice } });
  await prisma.invoiceItem.update({ where: { id: it.id }, data: { amount: newPrice } });
  touched.add(it.invoiceId);
  itemsRepriced++;
}
for (const invoiceId of touched) {
  const agg = await prisma.invoiceItem.aggregate({ where: { invoiceId }, _sum: { amount: true } });
  const total = agg._sum.amount ?? 0;
  await prisma.invoice.update({ where: { id: invoiceId }, data: { subtotal: total, total } });
}

console.log(
  `\n✅ Multi-dog rate applied: ${walksRepriced} upcoming walk(s) repriced, ` +
    `${itemsRepriced} invoiced walk(s) repriced across ${touched.size} unpaid invoice(s).\n`
);
await prisma.$disconnect();
