import { cronAuthorized } from "@/lib/cron-auth";
import { finalizeDueInvoices, remindAdminsToComplete } from "@/lib/billing-run";

export const dynamic = "force-dynamic";

// Run ~7pm daily: lock + email invoices for any client whose period ended
// today, and nudge admins about any walks still waiting to be completed.
async function run(req: Request) {
  if (!cronAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const result = await finalizeDueInvoices(now);
  const reminder = await remindAdminsToComplete(now);
  return Response.json({ ok: true, ...result, ...reminder });
}

export const GET = run;
export const POST = run;
