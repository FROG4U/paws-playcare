// Applying changes to a client's regular weekly days.
//
// The days shown on their card ("Field Play - Monday (AM)") are only a label:
// the walks themselves come from RECURRING bookings, one per service, each
// holding a set of weekdays. Every change has to move both, or the schedule
// and the invoices drift apart.
//
// Each change carries its own date, so an admin can drop Wednesdays from the
// 7th while adding Thursdays from next month. The money rules are kept here so
// every caller behaves the same:
//   * a day removed from D -> its walks on or after D that aren't done yet are
//     cancelled with no charge, and the pattern loses that weekday so the
//     nightly rollover never puts it back
//   * a day added from D    -> walks are generated from D (never earlier, never
//     backdated) to the 12-week horizon at the current rate
//   * completed walks are never touched, so anything already invoiced or paid
//     stays exactly as it was billed
import { prisma } from "./prisma";
import {
  getServices,
  serviceDays,
  servicePrice,
  resolveRequestedWalk,
  requestedWalkOptions,
} from "./services";
import { blockedDateKeys, expandRecurring } from "./availability";
import { atUtcMidnight, dayKey, formatDate } from "./dates";
import { BOOKING_STATUS, BOOKING_TYPE, WALK_STATUS } from "./constants";

const HORIZON_DAYS = 12 * 7;

const EDITABLE: string[] = [
  WALK_STATUS.REQUESTED,
  WALK_STATUS.ASSIGNED,
  WALK_STATUS.ACCEPTED,
  WALK_STATUS.DECLINED,
];

const DAY_LABEL: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
  5: "Friday", 6: "Saturday", 7: "Sunday",
};

const isoWeekdayOf = (d: Date) => ((d.getUTCDay() + 6) % 7) + 1;

export type SlotEdit = {
  slot: string;                 // "Field Play - Monday (AM)"
  action: "ADD" | "REMOVE";
  from?: string | null;         // yyyy-mm-dd; blank or past means today
};

export type SlotEditOutcome = {
  slot: string;
  action: "ADD" | "REMOVE";
  fromLabel: string;
  walks: number;                // booked, or cancelled
};

export type ApplySlotsResult =
  | {
      ok: true;
      outcomes: SlotEditOutcome[];
      walksCreated: number;
      walksCancelled: number;
      unresolved: string[];
      slots: string[];          // the client's days after the change
      summary: string;
    }
  | { ok: false; error: string };

// The days a client is actually booked for, read from their live bookings
// rather than the sign-up note, so edits always work off the real schedule.
function slotsFromBookings(
  bookings: { serviceId: string | null; serviceName: string | null; daysOfWeek: string; status: string }[],
  services: { id: string; name: string; daysOfWeek: string; timeSlot: string; active: boolean }[]
): string[] {
  const byValue = new Map<string, string>();
  for (const o of requestedWalkOptions(services)) {
    byValue.set(`${o.service.id}:${o.day}`, o.value);
  }
  const out: string[] = [];
  for (const b of bookings) {
    if (b.status !== BOOKING_STATUS.ACTIVE) continue;
    const service = services.find((s) => s.id === b.serviceId) ?? services.find((s) => s.name === b.serviceName);
    if (!service) continue;
    let days: number[] = [];
    try {
      const parsed = JSON.parse(b.daysOfWeek);
      if (Array.isArray(parsed)) days = parsed;
    } catch {}
    for (const d of days) {
      const label = byValue.get(`${service.id}:${d}`);
      if (label && !out.includes(label)) out.push(label);
    }
  }
  return out;
}

// Apply a set of dated changes to the client's regular days.
export async function applySlotEdits(
  clientId: string,
  edits: SlotEdit[],
  opts: { adminId?: string; now?: Date } = {}
): Promise<ApplySlotsResult> {
  const now = opts.now ?? new Date();
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { id: true, dogs: { select: { id: true } } },
  });
  if (!client) return { ok: false, error: "Client not found." };

  const services = await getServices();
  const todayKey = dayKey(now);
  const endKey = dayKey(new Date(atUtcMidnight(todayKey).getTime() + (HORIZON_DAYS - 1) * 86400000));
  const bhKeys = await blockedDateKeys();

  const unresolved: string[] = [];
  const outcomes: SlotEditOutcome[] = [];
  let walksCreated = 0;
  let walksCancelled = 0;

  for (const edit of edits) {
    const hit = resolveRequestedWalk(services, edit.slot);
    if (!hit) {
      unresolved.push(edit.slot);
      continue;
    }
    const { service, day } = hit;
    const fromKey = edit.from && edit.from > todayKey ? edit.from : todayKey;

    // Re-read each time: an earlier edit may have changed these bookings.
    const bookings = await prisma.booking.findMany({
      where: {
        clientId,
        type: BOOKING_TYPE.RECURRING,
        status: { in: [BOOKING_STATUS.ACTIVE, BOOKING_STATUS.PAUSED] },
      },
      include: { walks: { select: { id: true, date: true, status: true } } },
    });
    const forService = bookings.filter(
      (b) => b.serviceId === service.id || b.serviceName === service.name
    );
    const daysOf = (b: { daysOfWeek: string }) => {
      try {
        const parsed = JSON.parse(b.daysOfWeek);
        return Array.isArray(parsed) ? (parsed as number[]) : [];
      } catch {
        return [];
      }
    };

    if (edit.action === "REMOVE") {
      let cancelled = 0;
      for (const b of forService) {
        const days = daysOf(b);
        if (!days.includes(day)) continue;

        const doomed = b.walks.filter(
          (w) =>
            EDITABLE.includes(w.status) &&
            dayKey(w.date) >= fromKey &&
            isoWeekdayOf(w.date) === day
        );
        if (doomed.length) {
          await prisma.walk.updateMany({
            where: { id: { in: doomed.map((w) => w.id) } },
            data: {
              status: WALK_STATUS.CANCELLED,
              cancelledAt: now,
              cancelledById: opts.adminId ?? null,
              cancelReason: `${DAY_LABEL[day]} removed from the regular days from ${formatDate(fromKey)}`,
              noCharge: true, // a plan change, never a chargeable late cancellation
            },
          });
          cancelled += doomed.length;
        }

        const left = days.filter((d) => d !== day);
        await prisma.booking.update({
          where: { id: b.id },
          data: {
            daysOfWeek: JSON.stringify(left),
            status: left.length === 0 ? BOOKING_STATUS.ENDED : b.status,
          },
        });
      }
      walksCancelled += cancelled;
      outcomes.push({ slot: edit.slot, action: "REMOVE", fromLabel: formatDate(fromKey), walks: cancelled });
      continue;
    }

    // ADD
    if (!serviceDays(service).includes(day)) {
      unresolved.push(edit.slot);
      continue;
    }
    const already = forService.find((b) => b.status === BOOKING_STATUS.ACTIVE && daysOf(b).includes(day));
    if (already) {
      outcomes.push({ slot: edit.slot, action: "ADD", fromLabel: formatDate(fromKey), walks: 0 });
      continue;
    }

    const template = forService.find((b) => b.status === BOOKING_STATUS.ACTIVE);
    const dogIds: string[] = template
      ? (() => {
          try {
            const parsed = JSON.parse(template.dogIds);
            return Array.isArray(parsed) && parsed.length ? parsed : client.dogs.map((d) => d.id);
          } catch {
            return client.dogs.map((d) => d.id);
          }
        })()
      : client.dogs.map((d) => d.id);
    if (dogIds.length === 0) {
      unresolved.push(edit.slot);
      continue;
    }
    const numDogs = dogIds.length;
    const price = servicePrice(service, numDogs);
    const { dates } = expandRecurring([day], fromKey, endKey, bhKeys);

    if (template && fromKey === todayKey) {
      // Starts now: fold it into the service's existing booking.
      const live = new Set(
        template.walks.filter((w) => w.status !== WALK_STATUS.CANCELLED).map((w) => dayKey(w.date))
      );
      const toCreate = dates.filter((d) => !live.has(dayKey(d)));
      if (toCreate.length) {
        await prisma.walk.createMany({
          data: toCreate.map((d) => ({
            bookingId: template.id,
            clientId,
            date: d,
            timeSlot: template.timeSlot,
            serviceName: template.serviceName,
            numDogs: template.numDogs,
            price: servicePrice(service, template.numDogs),
            status: WALK_STATUS.REQUESTED,
          })),
        });
        walksCreated += toCreate.length;
      }
      await prisma.booking.update({
        where: { id: template.id },
        data: { daysOfWeek: JSON.stringify([...daysOf(template), day].sort()) },
      });
      outcomes.push({ slot: edit.slot, action: "ADD", fromLabel: formatDate(fromKey), walks: toCreate.length });
      continue;
    }

    // Starts later (or the service has no booking yet): its own booking, dated
    // from that day, so the rollover can't back-fill anything earlier.
    await prisma.booking.create({
      data: {
        clientId,
        serviceId: service.id,
        serviceName: service.name,
        type: BOOKING_TYPE.RECURRING,
        status: BOOKING_STATUS.ACTIVE,
        timeSlot: service.timeSlot,
        dogIds: JSON.stringify(dogIds),
        numDogs,
        startDate: atUtcMidnight(fromKey),
        endDate: null, // ongoing - the rollover keeps it topped up
        daysOfWeek: JSON.stringify([day]),
        termsAcceptedAt: now,
        reviewedAt: now,
        reviewedById: opts.adminId ?? null,
        decision: "ACCEPTED",
        walks: {
          create: dates.map((d) => ({
            clientId,
            date: d,
            timeSlot: service.timeSlot,
            serviceName: service.name,
            numDogs,
            price,
            status: WALK_STATUS.REQUESTED,
          })),
        },
      },
    });
    walksCreated += dates.length;
    outcomes.push({ slot: edit.slot, action: "ADD", fromLabel: formatDate(fromKey), walks: dates.length });
  }

  // Save the resulting days back onto the sign-up record, read from the
  // bookings themselves so the card can't disagree with the schedule.
  const after = await prisma.booking.findMany({
    where: { clientId, type: BOOKING_TYPE.RECURRING },
    select: { serviceId: true, serviceName: true, daysOfWeek: true, status: true },
  });
  const slots = slotsFromBookings(after, services);
  const order = requestedWalkOptions(services).map((o) => o.value);
  slots.sort((a, b) => (order.indexOf(a) + 1 || 9999) - (order.indexOf(b) + 1 || 9999));
  await prisma.user.update({ where: { id: clientId }, data: { regSlots: JSON.stringify(slots) } });

  const parts = outcomes.map((o) => {
    const what = o.action === "ADD" ? "added" : "removed";
    const count =
      o.action === "ADD"
        ? o.walks
          ? ` (${o.walks} walk${o.walks === 1 ? "" : "s"} booked)`
          : ""
        : o.walks
          ? ` (${o.walks} walk${o.walks === 1 ? "" : "s"} cancelled, no charge)`
          : " (no upcoming walks to cancel)";
    return `${o.slot} ${what} from ${o.fromLabel}${count}`;
  });

  return {
    ok: true,
    outcomes,
    walksCreated,
    walksCancelled,
    unresolved,
    slots,
    summary: parts.length ? parts.join("; ") : "Nothing to change.",
  };
}

// Set a client's days to exactly `slots`, all taking effect today. Used when
// approving a client's own request, where no dates are involved.
export async function applyRequestedSlots(
  clientId: string,
  slots: string[],
  opts: { adminId?: string; now?: Date } = {}
): Promise<ApplySlotsResult> {
  const services = await getServices();
  const bookings = await prisma.booking.findMany({
    where: { clientId, type: BOOKING_TYPE.RECURRING },
    select: { serviceId: true, serviceName: true, daysOfWeek: true, status: true },
  });
  const current = slotsFromBookings(bookings, services);
  const wanted = [...new Set(slots)];

  const edits: SlotEdit[] = [
    ...current.filter((s) => !wanted.includes(s)).map((s) => ({ slot: s, action: "REMOVE" as const })),
    ...wanted.filter((s) => !current.includes(s)).map((s) => ({ slot: s, action: "ADD" as const })),
  ];
  if (edits.length === 0) {
    return {
      ok: true,
      outcomes: [],
      walksCreated: 0,
      walksCancelled: 0,
      unresolved: [],
      slots: current,
      summary: "No change - those are already their days.",
    };
  }
  return applySlotEdits(clientId, edits, opts);
}
