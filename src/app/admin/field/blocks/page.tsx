import { prisma } from "@/lib/prisma";
import { atUtcMidnight, formatDate, dayKey } from "@/lib/dates";
import { slotLabel } from "@/lib/field";
import { FIELD_SLOT_KIND } from "@/lib/constants";
import { BlockForm, RemoveBlockButton } from "./BlockClient";

export const dynamic = "force-dynamic";

export default async function BlocksPage() {
  const today = atUtcMidnight(new Date());
  const blocks = await prisma.fieldSlot.findMany({
    where: { kind: FIELD_SLOT_KIND.BLOCK, date: { gte: today } },
    orderBy: [{ date: "asc" }, { hour: "asc" }],
  });

  // Group by day for a tidy list.
  const byDay = new Map<string, typeof blocks>();
  for (const b of blocks) {
    const k = dayKey(b.date);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(b);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Blocked times</h1>
        <p className="text-muted">Close the field for maintenance, private events or holidays.</p>
      </div>

      <BlockForm />

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Upcoming blocks ({blocks.length} hour{blocks.length === 1 ? "" : "s"})
        </h2>
        {byDay.size === 0 ? (
          <div className="card text-sm text-muted">No blocked times.</div>
        ) : (
          [...byDay.entries()].map(([k, rows]) => (
            <div key={k} className="card">
              <p className="mb-2 font-semibold">
                {formatDate(rows[0].date)}
                {rows[0].note ? <span className="ml-2 text-sm font-normal text-muted">{rows[0].note}</span> : null}
              </p>
              <div className="flex flex-wrap gap-2">
                {rows.map((r) => (
                  <span key={r.id} className="flex items-center gap-1 rounded-lg bg-mist px-2 py-1 text-sm">
                    {slotLabel(r.hour)}
                    <RemoveBlockButton id={r.id} />
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
