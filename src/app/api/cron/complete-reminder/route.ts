import { cronAuthorized } from "@/lib/cron-auth";
import { remindAdminsToComplete } from "@/lib/billing-run";

export const dynamic = "force-dynamic";

// Run ~6pm daily: push the day's outstanding walks at the admins so they can
// mark them done before invoices are finalised at 7pm. Completing a walk is
// what adds it to the client's invoice (on their own pay cycle) and notifies
// them — this is just the nudge. Safe to run more than once: only one reminder
// is sent per day.
async function run(req: Request) {
  if (!cronAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await remindAdminsToComplete(new Date());
  return Response.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
