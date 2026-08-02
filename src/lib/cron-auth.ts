// Shared guard for the billing cron routes. The scheduler must present the
// CRON_SECRET, either as `Authorization: Bearer <secret>` or `?key=<secret>`.
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed if not configured
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const key = new URL(req.url).searchParams.get("key");
  return key === secret;
}
