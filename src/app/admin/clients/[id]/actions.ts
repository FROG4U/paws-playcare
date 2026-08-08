"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { ROLES, PAY_CADENCE, BOOKING_STATUS, WALK_STATUS, NOTIF_TYPE, TIME_SLOTS } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { dayKey, atUtcMidnight } from "@/lib/dates";
import { poundsToPence } from "@/lib/money";
import { rolloverOngoingBookings } from "@/lib/rollover";

type Result = { ok: true } | { ok: false; error: string };

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true";
}

function refresh(id: string) {
  revalidatePath(`/admin/clients/${id}`);
  revalidatePath(`/admin/clients/${id}/edit`);
  revalidatePath("/admin/clients");
}

// Update the client's own profile fields.
export async function saveClient(_prev: Result | null, formData: FormData): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  const id = String(formData.get("id") || "");
  if (!id) return { ok: false, error: "Missing client id." };

  const name = str(formData, "name");
  const email = str(formData, "email");
  if (!name) return { ok: false, error: "Name is required." };
  if (!email) return { ok: false, error: "Email is required." };

  const cadenceRaw = String(formData.get("payCadence") || PAY_CADENCE.WEEKLY);
  const payCadence = (Object.values(PAY_CADENCE) as string[]).includes(cadenceRaw)
    ? cadenceRaw
    : PAY_CADENCE.WEEKLY;

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name,
        email: email.toLowerCase(),
        phone: str(formData, "phone"),
        address: str(formData, "address"),
        emergencyName: str(formData, "emergencyName"),
        emergencyPhone: str(formData, "emergencyPhone"),
        payCadence,
        notes: str(formData, "notes"),
      },
    });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique")
      ? "That email is already used by another account."
      : "Couldn't save. Please try again.";
    return { ok: false, error: msg };
  }

  refresh(id);
  return { ok: true };
}

// Update a single dog belonging to this client.
export async function saveDog(_prev: Result | null, formData: FormData): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  const dogId = String(formData.get("dogId") || "");
  const clientId = String(formData.get("clientId") || "");
  if (!dogId) return { ok: false, error: "Missing dog id." };

  const name = str(formData, "name");
  if (!name) return { ok: false, error: "The dog needs a name." };

  await prisma.dog.update({
    where: { id: dogId },
    data: {
      name,
      breed: str(formData, "breed"),
      age: str(formData, "age"),
      ageUnderOne: str(formData, "ageUnderOne"),
      neutered: bool(formData, "neutered"),
      healthDetails: str(formData, "healthDetails"),
      medicalConditions: bool(formData, "medicalConditions"),
      medicalDetails: str(formData, "medicalDetails"),
      vaccinationsCurrent: bool(formData, "vaccinationsCurrent"),
      kennelCoughCurrent: bool(formData, "kennelCoughCurrent"),
      allergies: str(formData, "allergies"),
      microchipped: bool(formData, "microchipped"),
      insured: bool(formData, "insured"),
      aggressionPeople: bool(formData, "aggressionPeople"),
      aggressionAnimals: bool(formData, "aggressionAnimals"),
      fenceJumping: bool(formData, "fenceJumping"),
      possessiveness: bool(formData, "possessiveness"),
      socialises: bool(formData, "socialises"),
      acceptsTreats: bool(formData, "acceptsTreats"),
      obedienceNotes: str(formData, "obedienceNotes"),
      historyBiting: bool(formData, "historyBiting"),
      historyGrowling: bool(formData, "historyGrowling"),
      escapeAttempts: bool(formData, "escapeAttempts"),
      reactedNegatively: bool(formData, "reactedNegatively"),
      negativeReactions: str(formData, "negativeReactions"),
      houseTrained: bool(formData, "houseTrained"),
      triggers: str(formData, "triggers"),
      otherNotes: str(formData, "otherNotes"),
    },
  });

  if (clientId) refresh(clientId);
  return { ok: true };
}

// Set / reset a client's login password (admin only). Returns the password so
// the admin can pass it to the client. Used for demo accounts and when a client
// is locked out — no server seed step needed.
export async function resetClientPassword(clientId: string, newPassword: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  if (!clientId) return { ok: false, error: "Missing client id." };
  const pw = (newPassword ?? "").trim();
  if (pw.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  const client = await prisma.user.findUnique({ where: { id: clientId }, select: { role: true } });
  if (!client) return { ok: false, error: "Client not found." };
  if (client.role !== ROLES.CLIENT) return { ok: false, error: "Only client accounts can be reset here." };

  await prisma.user.update({ where: { id: clientId }, data: { passwordHash: await hashPassword(pw) } });
  refresh(clientId);
  return { ok: true };
}

// Change a client's billing cycle (clients can't do this themselves).
export async function setClientCadence(clientId: string, cadence: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  if (!(Object.values(PAY_CADENCE) as string[]).includes(cadence)) {
    return { ok: false, error: "Invalid billing cycle." };
  }
  await prisma.user.update({ where: { id: clientId }, data: { payCadence: cadence } });
  refresh(clientId);
  return { ok: true };
}

// Archive / unarchive — reversible soft-hide from the active client list.
export async function archiveClient(id: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  await prisma.user.update({ where: { id }, data: { archivedAt: new Date() } });
  refresh(id);
  return { ok: true };
}

export async function unarchiveClient(id: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  await prisma.user.update({ where: { id }, data: { archivedAt: null } });
  refresh(id);
  return { ok: true };
}

// Permanently delete the client and everything of theirs (dogs, bookings,
// walks, invoices — all cascade). Irreversible.
export async function deleteClient(id: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!user) return { ok: false, error: "Client not found." };
  if (user.role !== ROLES.CLIENT) return { ok: false, error: "Only client accounts can be deleted here." };

  try {
    await prisma.user.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Couldn't delete this client. Please try again." };
  }
  revalidatePath("/admin/clients");
  redirect("/admin/clients");
}

// ── Walk details (edit from the client card) ────────────────────────────────
// Edit an upcoming walk's date, time slot, price or no-charge flag. Completed
// or cancelled walks are left alone (they may already be on an invoice).
export async function updateWalkDetails(
  walkId: string,
  input: { dateIso?: string; timeSlot?: string; pricePounds?: string; noCharge?: boolean }
): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  const walk = await prisma.walk.findUnique({
    where: { id: walkId },
    select: { status: true, clientId: true },
  });
  if (!walk) return { ok: false, error: "Walk not found." };
  if (walk.status === WALK_STATUS.COMPLETED || walk.status === WALK_STATUS.CANCELLED) {
    return { ok: false, error: "Only upcoming walks can be edited." };
  }

  const data: {
    date?: Date;
    timeSlot?: string;
    price?: number;
    noCharge?: boolean;
  } = {};

  if (input.dateIso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateIso)) return { ok: false, error: "Invalid date." };
    data.date = atUtcMidnight(input.dateIso);
  }
  if (input.timeSlot && (TIME_SLOTS as readonly string[]).includes(input.timeSlot)) {
    data.timeSlot = input.timeSlot;
  }
  if (input.pricePounds != null && input.pricePounds !== "") {
    const pence = poundsToPence(input.pricePounds);
    if (pence < 0) return { ok: false, error: "Price can't be negative." };
    data.price = pence;
  }
  if (typeof input.noCharge === "boolean") data.noCharge = input.noCharge;

  if (Object.keys(data).length === 0) return { ok: false, error: "Nothing to update." };

  await prisma.walk.update({ where: { id: walkId }, data });
  refresh(walk.clientId);
  return { ok: true };
}

// ── Pause requests ──────────────────────────────────────────────────────────
// A client can only request a pause; an admin actions it here.

// Pause all of a client's walks: mark their active bookings PAUSED and cancel
// every upcoming (not-yet-done) walk with no charge. Clears the request.
export async function pauseClientWalks(clientId: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  const client = await prisma.user.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) return { ok: false, error: "Client not found." };

  const todayStart = new Date(dayKey(new Date()) + "T00:00:00.000Z");
  await prisma.$transaction([
    prisma.booking.updateMany({
      where: { clientId, status: BOOKING_STATUS.ACTIVE },
      data: { status: BOOKING_STATUS.PAUSED },
    }),
    prisma.walk.updateMany({
      where: {
        clientId,
        date: { gte: todayStart },
        status: { notIn: [WALK_STATUS.COMPLETED, WALK_STATUS.CANCELLED] },
      },
      data: { status: WALK_STATUS.CANCELLED, cancelledAt: new Date(), cancelReason: "Walks paused", noCharge: true },
    }),
    prisma.user.update({ where: { id: clientId }, data: { pauseRequestedAt: null, pauseRequestReason: null } }),
  ]);

  await notify({
    userId: clientId,
    type: NOTIF_TYPE.PAUSE_RESOLVED,
    title: "Your walks are paused",
    body: "We've paused your walks and cancelled upcoming ones with no charge. Just let us know when you'd like to resume.",
    link: "/client/walks",
  });
  refresh(clientId);
  return { ok: true };
}

// Resume a paused client: reactivate their paused bookings and immediately
// top ongoing ones back up to the 12-week horizon.
export async function resumeClientWalks(clientId: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  await prisma.booking.updateMany({
    where: { clientId, status: BOOKING_STATUS.PAUSED },
    data: { status: BOOKING_STATUS.ACTIVE },
  });
  await rolloverOngoingBookings(new Date()); // idempotent refill of ongoing plans
  await notify({
    userId: clientId,
    type: NOTIF_TYPE.PAUSE_RESOLVED,
    title: "Your walks are back on",
    body: "We've resumed your walks — your regular schedule is running again.",
    link: "/client/walks",
  });
  refresh(clientId);
  return { ok: true };
}

// Decline / clear a pending pause request without pausing anything.
export async function dismissPauseRequest(clientId: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  await prisma.user.update({
    where: { id: clientId },
    data: { pauseRequestedAt: null, pauseRequestReason: null },
  });
  await notify({
    userId: clientId,
    type: NOTIF_TYPE.PAUSE_RESOLVED,
    title: "About your pause request",
    body: "We've looked at your pause request — please get in touch so we can sort out the details with you.",
    link: "/client",
  });
  refresh(clientId);
  return { ok: true };
}
