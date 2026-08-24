import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getServices } from "@/lib/services";
import { serviceColorMap, paletteFor } from "@/lib/service-colors";
import { dayKey, isoWeekday } from "@/lib/dates";
import { WALK_STATUS, walkStatusBadge } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// "Buddy" · "Buddy & Rex" · "Buddy, Max & Rex"
function joinDogNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ ym?: string }>;
}) {
  const { ym } = await searchParams;
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1; // 1–12
  const m = /^(\d{4})-(\d{2})$/.exec(ym ?? "");
  if (m) {
    year = Number(m[1]);
    month = Math.min(12, Math.max(1, Number(m[2])));
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = new Date(Date.UTC(year, month - 1, daysInMonth));

  const [services, walks] = await Promise.all([
    getServices(),
    prisma.walk.findMany({
      where: { date: { gte: first, lte: last } },
      include: {
        client: { select: { name: true } },
        worker: { select: { name: true } },
        booking: { select: { dogIds: true } },
      },
      orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    }),
  ]);
  const colorMap = serviceColorMap(services);

  // Resolve dog names for every walk (from its booking's dog list), in one query.
  const dogIdSet = new Set<string>();
  for (const w of walks) {
    try {
      const ids = JSON.parse(w.booking?.dogIds ?? "[]");
      if (Array.isArray(ids)) for (const id of ids) dogIdSet.add(id);
    } catch {}
  }
  const dogs = dogIdSet.size
    ? await prisma.dog.findMany({ where: { id: { in: [...dogIdSet] } }, select: { id: true, name: true } })
    : [];
  const dogName = new Map(dogs.map((d) => [d.id, d.name] as const));
  // Dog name(s) for a walk, falling back to the client's first name if none.
  const labelFor = (w: (typeof walks)[number]): string => {
    try {
      const ids = JSON.parse(w.booking?.dogIds ?? "[]");
      if (Array.isArray(ids) && ids.length) {
        const names = ids.map((id: string) => dogName.get(id)).filter(Boolean) as string[];
        if (names.length) return joinDogNames(names);
      }
    } catch {}
    return w.client.name.split(" ")[0];
  };

  // Group walks by day.
  const byDay = new Map<string, typeof walks>();
  for (const w of walks) {
    const k = dayKey(w.date);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(w);
  }

  const active = walks.filter((w) => w.status !== WALK_STATUS.CANCELLED && w.status !== WALK_STATUS.DECLINED);
  const completed = walks.filter((w) => w.status === WALK_STATUS.COMPLETED).length;
  const cancelled = walks.length - active.length;

  // Prev / next month keys.
  const prev = month === 1 ? `${year - 1}-12` : `${year}-${pad(month - 1)}`;
  const next = month === 12 ? `${year + 1}-01` : `${year}-${pad(month + 1)}`;
  const thisYm = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}`;
  const todayKey = dayKey(now);

  const leadingBlanks = isoWeekday(first) - 1; // Monday-first

  return (
    <div className="space-y-5">
      <PageHeader icon="calendar" title="Calendar" subtitle="Every walk, month by month." />

      {/* Month controls + summary */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`/admin/calendar?ym=${prev}`} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted hover:bg-brand-soft" aria-label="Previous month">‹</Link>
          <h2 className="min-w-[10rem] text-center text-lg font-bold">{MONTHS[month - 1]} {year}</h2>
          <Link href={`/admin/calendar?ym=${next}`} className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted hover:bg-brand-soft" aria-label="Next month">›</Link>
          {`${year}-${pad(month)}` !== thisYm && (
            <Link href={`/admin/calendar?ym=${thisYm}`} className="btn-ghost text-sm">Today</Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span><strong className="text-foreground">{active.length}</strong> walks</span>
          <span><strong className="text-success">{completed}</strong> completed</span>
          {cancelled > 0 && <span><strong className="text-danger">{cancelled}</strong> cancelled</span>}
        </div>
      </div>

      {/* Legend */}
      {services.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-muted">
          {services.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: paletteFor(colorMap[s.name] ?? 0).solid }} />
              {s.name}
            </span>
          ))}
        </div>
      )}

      {/* Month grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[46rem]">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: "6px" }}>
            {DOW.map((d) => (
              <div key={d} className="pb-1 text-center text-[0.7rem] font-bold uppercase tracking-wide text-muted">{d}</div>
            ))}
            {Array.from({ length: leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dnum = i + 1;
              const key = `${year}-${pad(month)}-${pad(dnum)}`;
              const isToday = key === todayKey;
              const dayWalks = byDay.get(key) ?? [];
              const isWeekend = isoWeekday(new Date(key + "T00:00:00.000Z")) >= 6;
              return (
                <div
                  key={key}
                  className={`flex min-h-[7rem] flex-col rounded-xl border p-1.5 ${
                    isToday ? "border-brand bg-brand-soft/30" : "border-border"
                  } ${isWeekend ? "bg-mist/40" : "bg-surface"}`}
                >
                  <span className={`mb-1 px-1 text-xs font-bold ${isToday ? "text-brand" : "text-muted"}`}>{dnum}</span>
                  <div className="flex flex-col gap-1">
                    {dayWalks.slice(0, 4).map((w) => {
                      const idx = w.serviceName != null ? colorMap[w.serviceName] ?? null : null;
                      const pal = typeof idx === "number" ? paletteFor(idx) : null;
                      const dead = w.status === WALK_STATUS.CANCELLED || w.status === WALK_STATUS.DECLINED;
                      const done = w.status === WALK_STATUS.COMPLETED;
                      const dogsLabel = labelFor(w);
                      const inner = (
                        <span
                          className={`flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[0.7rem] font-semibold ${dead ? "line-through opacity-50" : ""}`}
                          style={{ background: dead ? "#f1f5f9" : pal?.soft ?? "#eef2f7", color: dead ? "#94a3b8" : pal?.softText ?? "#475569" }}
                          title={[dogsLabel, w.client.name, w.serviceName ?? "Walk", walkStatusBadge(w.status)]
                            .filter(Boolean)
                            .join(" · ")}
                        >
                          {done && <Icon name="check" className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{dogsLabel}</span>
                        </span>
                      );
                      return w.bookingId ? (
                        <Link key={w.id} href={`/admin/bookings/${w.bookingId}`} className="block hover:opacity-80">{inner}</Link>
                      ) : (
                        <div key={w.id}>{inner}</div>
                      );
                    })}
                    {dayWalks.length > 4 && (
                      <span className="px-1 text-[0.7rem] font-semibold text-muted">+{dayWalks.length - 4} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {walks.length === 0 && (
        <p className="text-center text-sm text-muted">No walks scheduled in {MONTHS[month - 1]} {year}.</p>
      )}
    </div>
  );
}
