import { prisma } from "@/lib/prisma";
import { atUtcMidnight, formatDate, dayKey } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { CloseDayForm, ReopenButton } from "./DaysOffClient";

export const dynamic = "force-dynamic";

export default async function DaysOffPage() {
  const today = atUtcMidnight(new Date());
  const [closures, holidays] = await Promise.all([
    prisma.closedDay.findMany({ where: { date: { gte: today } }, orderBy: { date: "asc" } }),
    prisma.bankHoliday.findMany({ where: { date: { gte: today } }, orderBy: { date: "asc" }, take: 8 }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="x"
        title="Days off"
        subtitle="Close a day when you're not working — walks are cancelled with no charge and clients are emailed."
      />

      <CloseDayForm />

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Upcoming closures ({closures.length})
        </h2>
        {closures.length === 0 ? (
          <div className="card text-sm text-muted">No days closed.</div>
        ) : (
          <div className="space-y-2">
            {closures.map((c) => (
              <div key={c.id} className="card flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{formatDate(c.date)}</p>
                  <p className="text-sm text-muted">{c.reason}</p>
                </div>
                <ReopenButton dateKey={dayKey(c.date)} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bank holidays are handled automatically — shown here for reference. */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Upcoming bank holidays (auto-skipped)
        </h2>
        {holidays.length === 0 ? (
          <div className="card text-sm text-muted">
            No bank holidays loaded. Sync them from Pricing → &quot;Sync bank holidays&quot;.
          </div>
        ) : (
          <div className="card">
            <ul className="space-y-1 text-sm">
              {holidays.map((h) => (
                <li key={h.id} className="flex justify-between">
                  <span className="font-medium">{formatDate(h.date)}</span>
                  <span className="text-muted">{h.title}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted">
              Recurring bookings never schedule walks on these — they&apos;re skipped automatically.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
