import { prisma } from "@/lib/prisma";
import { atUtcMidnight, formatDate, dayKey } from "@/lib/dates";
import { slotLabel } from "@/lib/field";
import { FIELD_SLOT_KIND } from "@/lib/constants";
import { BlockForm, RemoveBlockButton, ClearDayButton, RemoveSeriesButton } from "./BlockClient";

export const dynamic = "force-dynamic";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]; // getUTCDay index

export default async function BlocksPage() {
  const today = atUtcMidnight(new Date());
  const blocks = await prisma.fieldSlot.findMany({
    where: { kind: FIELD_SLOT_KIND.BLOCK, date: { gte: today } },
    orderBy: [{ date: "asc" }, { hour: "asc" }],
  });

  // Group by the block series (all slots from one action). Legacy blocks with
  // no group id fall back to one group per day.
  const groups = new Map<string, typeof blocks>();
  for (const b of blocks) {
    const key = b.blockGroupId ?? `day:${dayKey(b.date)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }
  const ordered = [...groups.entries()].sort((a, b) => a[1][0].date.getTime() - b[1][0].date.getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Blocked times</h1>
        <p className="text-muted">Close the field for maintenance, private events or holidays.</p>
      </div>

      <BlockForm />

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Upcoming blocks ({blocks.length} hour{blocks.length === 1 ? "" : "s"})
        </h2>
        {ordered.length === 0 ? (
          <div className="card text-sm text-muted">No blocked times.</div>
        ) : (
          ordered.map(([key, rows]) => {
            const dates = [...new Set(rows.map((r) => dayKey(r.date)))].sort();
            const multiDay = dates.length > 1;
            const repeat = rows.some((r) => r.blockRepeat);
            const groupId = rows[0].blockGroupId;
            const note = rows.find((r) => r.note)?.note ?? null;

            // Distinct weekdays (ISO Mon-first) for the "Every Mon, Wed" label.
            const isoDays = [...new Set(dates.map((d) => new Date(d + "T00:00:00.000Z").getUTCDay()))]
              .sort((a, c) => ((a === 0 ? 7 : a) - (c === 0 ? 7 : c)));
            const weekdayNames = isoDays.map((x) => WD[x]).join(", ");

            const firstDate = new Date(dates[0] + "T00:00:00.000Z");
            const lastDate = new Date(dates[dates.length - 1] + "T00:00:00.000Z");
            const rangeLabel = multiDay
              ? `${formatDate(firstDate)} – ${formatDate(lastDate)}`
              : formatDate(firstDate);

            // Slots per day.
            const byDate = new Map<string, { id: string; hour: number }[]>();
            for (const r of rows) {
              const d = dayKey(r.date);
              if (!byDate.has(d)) byDate.set(d, []);
              byDate.get(d)!.push({ id: r.id, hour: r.hour });
            }

            return (
              <div key={key} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={`badge ${repeat ? "bg-brand-soft text-brand-dark" : "bg-mist text-muted"}`}>
                        {repeat ? "🔁 Repeating" : "One-off"}
                      </span>
                      {repeat && <span className="text-sm text-muted">Every {weekdayNames}</span>}
                    </div>
                    <p className="font-semibold">{rangeLabel}</p>
                    {note && <p className="text-sm text-muted">{note}</p>}
                    <p className="mt-0.5 text-xs text-muted">
                      {dates.length} day{dates.length === 1 ? "" : "s"} · {rows.length} hour{rows.length === 1 ? "" : "s"} blocked
                    </p>
                  </div>
                  {groupId ? (
                    <RemoveSeriesButton groupId={groupId} repeat={repeat} />
                  ) : (
                    <ClearDayButton dateKey={dates[0]} />
                  )}
                </div>

                <div className="space-y-1.5 border-t border-border pt-2">
                  {dates.map((d) => (
                    <div key={d} className="flex flex-wrap items-center gap-2">
                      {multiDay && (
                        <span className="w-32 shrink-0 text-sm font-medium text-muted">{formatDate(new Date(d + "T00:00:00.000Z"))}</span>
                      )}
                      {byDate.get(d)!.sort((a, b) => a.hour - b.hour).map((s) => (
                        <span key={s.id} className="flex items-center gap-1 rounded-lg bg-mist px-2 py-1 text-sm">
                          {slotLabel(s.hour)}
                          <RemoveBlockButton id={s.id} />
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
