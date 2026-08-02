import { cronAuthorized } from "@/lib/cron-auth";
import { finalizeDueInvoices } from "@/lib/billing-run";

export const dynamic = "force-dynamic";

// Run ~7pm daily: lock + email invoices for any client whose period ended today.
async function run(req: Request) {
  if (!cronAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await finalizeDueInvoices(new Date());
  return Response.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
