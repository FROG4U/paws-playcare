"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { ROLES, PAY_CADENCE } from "@/lib/constants";

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
