"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notifications";
import { NOTIF_TYPE, PAY_CADENCE, ROLES, USER_STATUS } from "@/lib/constants";

const req = (label: string) =>
  z.string().trim().min(1, { message: `${label} is required` });

const dogSchema = z.object({
  name: req("Dog's name"),
  breed: req("Breed"),
  age: req("Age"),
  ageUnderOne: z.string().optional().default(""),
  neutered: z.boolean().default(false),
  healthDetails: req("Health details"),
  medicalConditions: z.boolean().default(false),
  medicalDetails: z.string().optional().default(""),
  vaccinationsCurrent: z.boolean().default(false),
  kennelCoughCurrent: z.boolean().default(false),
  allergies: z.string().optional().default(""),
  microchipped: z.boolean().default(false),
  insured: z.boolean().default(false),
  aggressionPeople: z.boolean().default(false),
  aggressionAnimals: z.boolean().default(false),
  fenceJumping: z.boolean().default(false),
  possessiveness: z.boolean().default(false),
  socialises: z.boolean().default(true),
  acceptsTreats: z.boolean().default(true),
  obedienceNotes: req("Obedience / command words"),
  historyBiting: z.boolean().default(false),
  historyGrowling: z.boolean().default(false),
  escapeAttempts: z.boolean().default(false),
  reactedNegatively: z.boolean().default(false),
  negativeReactions: z.string().optional().default(""),
  houseTrained: z.boolean().default(true),
  triggers: req("What unsettles your dog"),
  otherNotes: req("Any other details"),
});

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional().default(""),
  address: z.string().optional().default(""),
  emergencyName: req("Emergency contact name"),
  emergencyPhone: req("Emergency contact number"),
  payCadence: z.enum([
    PAY_CADENCE.DAILY,
    PAY_CADENCE.WEEKLY,
    PAY_CADENCE.MONTHLY,
  ]),
  startDate: req("Start date"),
  slots: z.array(z.string()).default([]),
  infoAccurate: z.boolean().refine((v) => v === true, {
    message: "Please confirm the information is accurate.",
  }),
  acceptedTerms: z.boolean().refine((v) => v === true, {
    message: "Please accept the terms & conditions.",
  }),
  dogs: z.array(dogSchema).min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type RegisterResult = { ok: true } | { ok: false; error: string };

export async function registerClient(
  raw: unknown
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    // Show the plain message (its own text already says what's needed), with a
    // "Dog N" prefix for per-dog fields — never the raw field path.
    let message = "Please check the form and try again.";
    if (first) {
      message = first.message;
      if (first.path[0] === "dogs" && typeof first.path[1] === "number") {
        message = `Dog ${first.path[1] + 1}: ${first.message}`;
      }
    }
    return { ok: false, error: message };
  }
  const data = parsed.data;
  const email = data.email.trim().toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: ROLES.CLIENT,
      status: USER_STATUS.PENDING,
      name: data.name.trim(),
      phone: data.phone,
      address: data.address,
      emergencyName: data.emergencyName,
      emergencyPhone: data.emergencyPhone,
      payCadence: data.payCadence,
      regStartDate: data.startDate
        ? new Date(data.startDate + "T00:00:00.000Z")
        : null,
      regSlots: JSON.stringify(data.slots ?? []),
      agreedTermsAt: new Date(),
      dogs: {
        create: data.dogs.map((d) => ({
          name: d.name,
          breed: d.breed || null,
          age: d.age || null,
          ageUnderOne: d.ageUnderOne || null,
          neutered: d.neutered,
          healthDetails: d.healthDetails || null,
          medicalConditions: d.medicalConditions,
          medicalDetails: d.medicalDetails || null,
          vaccinationsCurrent: d.vaccinationsCurrent,
          kennelCoughCurrent: d.kennelCoughCurrent,
          allergies: d.allergies || null,
          microchipped: d.microchipped,
          insured: d.insured,
          aggressionPeople: d.aggressionPeople,
          aggressionAnimals: d.aggressionAnimals,
          fenceJumping: d.fenceJumping,
          possessiveness: d.possessiveness,
          socialises: d.socialises,
          acceptsTreats: d.acceptsTreats,
          obedienceNotes: d.obedienceNotes || null,
          historyBiting: d.historyBiting,
          historyGrowling: d.historyGrowling,
          escapeAttempts: d.escapeAttempts,
          reactedNegatively: d.reactedNegatively,
          negativeReactions: d.negativeReactions || null,
          houseTrained: d.houseTrained,
          triggers: d.triggers || null,
          otherNotes: d.otherNotes || null,
        })),
      },
    },
  });

  await notifyAdmins({
    type: NOTIF_TYPE.ACCOUNT_PENDING,
    title: "New client awaiting approval",
    body: `${user.name} (${user.email}) registered with ${data.dogs.length} dog(s).`,
    link: "/admin/approvals",
  });

  return { ok: true };
}
