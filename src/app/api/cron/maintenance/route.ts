import { cronAuthorized } from "@/lib/cron-auth";
import { warnExpiringCards, blockOverdueClients, remindClientsWithoutCard } from "@/lib/billing-run";
import { releaseStaleFieldHolds } from "@/lib/field";
import { rolloverOngoingBookings } from "@/lib/rollover";
import { syncBankHolidays } from "@/lib/bankHolidays";

export const dynamic = "force-dynamic";

// Run once a day (e.g. morning): warn about expiring cards and block accounts
// with invoices unpaid past the grace period.
async function run(req: Request) {
  if (!cronAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const cards = await warnExpiringCards(now);
  const noCard = await remindClientsWithoutCard(now);
  const blocks = await blockOverdueClients(now);
  const releasedFieldHolds = await releaseStaleFieldHolds(now);
  // Keep the UK bank-holiday list current so recurring bookings always skip
  // them (best-effort — ignore feed hiccups). Run BEFORE the rollover.
  const bankHolidaySync = await syncBankHolidays().then((r) => r.added).catch(() => null);
  const rolled = await rolloverOngoingBookings(now);
  return Response.json({ ok: true, ...cards, ...noCard, ...blocks, releasedFieldHolds, bankHolidaySync, ...rolled });
}

export const GET = run;
export const POST = run;
