import { cronAuthorized } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { createBookingsFromRegistration } from "@/lib/registration-booking";

export const dynamic = "force-dynamic";

// One-off catch-up for clients approved before approval set their schedule up
// automatically: every active client who has a card, no bookings at all, and
// walks they asked for at sign-up gets those booked as an ongoing repeat from
// today (never backdated). Run it once; running it again is harmless — anyone
// already booked is skipped.
//
//   curl "https://pawsplaycare.co.uk/api/cron/setup-regular-walks?key=CRON_SECRET"
async function run(req: Request) {
  if (!cronAuthorized(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const clients = await prisma.user.findMany({
    where: {
      role: ROLES.CLIENT,
      status: USER_STATUS.ACTIVE,
      archivedAt: null,
      paymentMethodId: { not: null },
      bookings: { none: {} },
    },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const setUp: { client: string; walks: number; services: string[] }[] = [];
  const skipped: { client: string; reason: string }[] = [];
  const needsAttention: { client: string; slots: string[] }[] = [];

  for (const c of clients) {
    const r = await createBookingsFromRegistration(c.id, {
      requireCard: true,
      requireActive: true,
    });
    if (r.bookingsCreated > 0) {
      setUp.push({ client: c.name, walks: r.walksCreated, services: r.services });
      if (r.unresolved.length) needsAttention.push({ client: c.name, slots: r.unresolved });
    } else {
      skipped.push({ client: c.name, reason: r.skipped });
    }
  }

  // Clients deliberately left alone: no card on file yet.
  const waitingForCard = await prisma.user.count({
    where: {
      role: ROLES.CLIENT,
      status: USER_STATUS.ACTIVE,
      archivedAt: null,
      paymentMethodId: null,
      bookings: { none: {} },
    },
  });

  return Response.json({
    ok: true,
    clientsSetUp: setUp.length,
    walksCreated: setUp.reduce((n, s) => n + s.walks, 0),
    setUp,
    skipped,
    needsAttention,
    waitingForCard,
  });
}

export const GET = run;
export const POST = run;
