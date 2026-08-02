import { cronAuthorized } from "@/lib/cron-auth";
import { chargeDueInvoices } from "@/lib/billing-run";

export const dynamic = "force-dynamic";

// Run later that night: charge the saved card for every issued, due invoice.
async function run(req: Request) {
  if (!cronAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await chargeDueInvoices(new Date());
  return Response.json({ ok: true, ...result });
}

export const GET = run;
export const POST = run;
