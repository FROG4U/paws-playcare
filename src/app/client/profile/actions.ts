"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/guard";

type Result = { ok: true } | { ok: false; error: string };

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}
function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true";
}

function refresh() {
  revalidatePath("/client/profile");
  revalidatePath("/client/book");
  revalidatePath("/client");
}

// Update the client's own contact details (email included — it's their login).
export async function saveMyProfile(_prev: Result | null, fd: FormData): Promise<Result> {
  const user = await requireClient();
  const name = str(fd, "name");
  const email = str(fd, "email");
  if (!name) return { ok: false, error: "Name is required." };
  if (!email) return { ok: false, error: "Email is required." };

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        email: email.toLowerCase(),
        phone: str(fd, "phone"),
        address: str(fd, "address"),
        emergencyName: str(fd, "emergencyName"),
        emergencyPhone: str(fd, "emergencyPhone"),
      },
    });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique")
      ? "That email is already in use by another account."
      : "Couldn't save. Please try again.";
    return { ok: false, error: msg };
  }
  refresh();
  return { ok: true };
}

function dogDataFromForm(fd: FormData) {
  return {
    name: str(fd, "name") ?? "",
    breed: str(fd, "breed"),
    age: str(fd, "age"),
    ageUnderOne: str(fd, "ageUnderOne"),
    neutered: bool(fd, "neutered"),
    healthDetails: str(fd, "healthDetails"),
    medicalConditions: bool(fd, "medicalConditions"),
    medicalDetails: str(fd, "medicalDetails"),
    vaccinationsCurrent: bool(fd, "vaccinationsCurrent"),
    kennelCoughCurrent: bool(fd, "kennelCoughCurrent"),
    allergies: str(fd, "allergies"),
    microchipped: bool(fd, "microchipped"),
    insured: bool(fd, "insured"),
    aggressionPeople: bool(fd, "aggressionPeople"),
    aggressionAnimals: bool(fd, "aggressionAnimals"),
    fenceJumping: bool(fd, "fenceJumping"),
    possessiveness: bool(fd, "possessiveness"),
    socialises: bool(fd, "socialises"),
    acceptsTreats: bool(fd, "acceptsTreats"),
    obedienceNotes: str(fd, "obedienceNotes"),
    historyBiting: bool(fd, "historyBiting"),
    historyGrowling: bool(fd, "historyGrowling"),
    escapeAttempts: bool(fd, "escapeAttempts"),
    reactedNegatively: bool(fd, "reactedNegatively"),
    negativeReactions: str(fd, "negativeReactions"),
    houseTrained: bool(fd, "houseTrained"),
    triggers: str(fd, "triggers"),
    otherNotes: str(fd, "otherNotes"),
  };
}

async function ownDog(userId: string, dogId: string) {
  const dog = await prisma.dog.findUnique({ where: { id: dogId }, select: { ownerId: true } });
  return dog && dog.ownerId === userId;
}

export async function addMyDog(_prev: Result | null, fd: FormData): Promise<Result> {
  const user = await requireClient();
  const data = dogDataFromForm(fd);
  if (!data.name) return { ok: false, error: "Your dog needs a name." };
  await prisma.dog.create({ data: { ...data, ownerId: user.id } });
  refresh();
  return { ok: true };
}

export async function saveMyDog(_prev: Result | null, fd: FormData): Promise<Result> {
  const user = await requireClient();
  const dogId = String(fd.get("dogId") || "");
  if (!(await ownDog(user.id, dogId))) return { ok: false, error: "Dog not found." };
  const data = dogDataFromForm(fd);
  if (!data.name) return { ok: false, error: "Your dog needs a name." };
  await prisma.dog.update({ where: { id: dogId }, data });
  refresh();
  return { ok: true };
}

export async function archiveMyDog(dogId: string): Promise<Result> {
  const user = await requireClient();
  if (!(await ownDog(user.id, dogId))) return { ok: false, error: "Dog not found." };
  await prisma.dog.update({ where: { id: dogId }, data: { archivedAt: new Date() } });
  refresh();
  return { ok: true };
}

export async function unarchiveMyDog(dogId: string): Promise<Result> {
  const user = await requireClient();
  if (!(await ownDog(user.id, dogId))) return { ok: false, error: "Dog not found." };
  await prisma.dog.update({ where: { id: dogId }, data: { archivedAt: null } });
  refresh();
  return { ok: true };
}
