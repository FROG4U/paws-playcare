"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { saveCompressedImage, deleteUpload } from "@/lib/upload";
import { atUtcMidnight } from "@/lib/dates";
import { poundsToPence } from "@/lib/money";
import { uniqueEventSlug, announceEvent } from "@/lib/events";
import { removeEventSignupFromInvoice } from "@/lib/billing";

export type Result = { ok: true; message: string } | { ok: false; error: string };

function refresh(slug?: string) {
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/client");
  revalidatePath("/client/events");
  if (slug) revalidatePath(`/events/${slug}`);
}

const str = (fd: FormData, key: string): string | null => {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Create or update an event. The image is re-encoded to a small WebP on the
// way in (lib/upload), so whatever size photo gets picked, what's stored and
// served is tiny.
export async function saveEvent(fd: FormData): Promise<Result> {
  await requireRole([ROLES.ADMIN]);

  const id = str(fd, "id");
  const title = str(fd, "title");
  if (!title) return { ok: false, error: "Give the event a title." };

  const dateStr = str(fd, "date");
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, error: "Pick the date the event runs." };
  }

  const startTime = str(fd, "startTime");
  const endTime = str(fd, "endTime");
  for (const [label, t] of [["start", startTime], ["end", endTime]] as const) {
    if (t && !TIME_RE.test(t)) return { ok: false, error: `That ${label} time doesn't look right.` };
  }
  if (startTime && endTime && endTime <= startTime) {
    return { ok: false, error: "The end time needs to be after the start time." };
  }

  // Both optional: blank price means free, blank places means no limit.
  const priceRaw = str(fd, "price");
  let pricePence: number | null = null;
  if (priceRaw != null) {
    const parsed = Number(priceRaw);
    if (!Number.isFinite(parsed) || parsed < 0) return { ok: false, error: "That price doesn't look right." };
    pricePence = poundsToPence(parsed);
  }

  const capacityRaw = str(fd, "capacity");
  let capacity: number | null = null;
  if (capacityRaw != null) {
    const parsed = Number(capacityRaw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { ok: false, error: "Places has to be a whole number, or leave it blank for no limit." };
    }
    capacity = parsed;
  }

  const data = {
    title,
    description: str(fd, "description"),
    address: str(fd, "address"),
    date: atUtcMidnight(dateStr),
    startTime,
    endTime,
    pricePence,
    capacity,
    askDogName: fd.get("askDogName") === "on",
    active: fd.get("active") === "on",
  };

  // Image: a new upload replaces the old file; "removeImage" clears it.
  const file = fd.get("image");
  const hasNewImage = file instanceof File && file.size > 0;
  const existing = id ? await prisma.event.findUnique({ where: { id } }) : null;
  if (id && !existing) return { ok: false, error: "That event no longer exists." };

  let imagePath: string | null | undefined;
  if (hasNewImage) {
    try {
      imagePath = await saveCompressedImage(file as File, { maxWidth: 1600, quality: 72 });
    } catch {
      return { ok: false, error: "That image couldn't be read. Try a JPG or PNG." };
    }
    if (existing?.imagePath) await deleteUpload(existing.imagePath);
  } else if (fd.get("removeImage") === "on") {
    if (existing?.imagePath) await deleteUpload(existing.imagePath);
    imagePath = null;
  }

  if (existing) {
    const slug =
      existing.title === title ? existing.slug : await uniqueEventSlug(title, existing.id);
    await prisma.event.update({
      where: { id: existing.id },
      data: { ...data, slug, ...(imagePath !== undefined ? { imagePath } : {}) },
    });
    const told = await announceEvent(existing.id);
    refresh(slug);
    return {
      ok: true,
      message: told.announcedTo
        ? `Event saved and ${told.announcedTo} client${told.announcedTo === 1 ? "" : "s"} told about it.`
        : "Event saved.",
    };
  }

  const slug = await uniqueEventSlug(title);
  const created = await prisma.event.create({
    data: { ...data, slug, imagePath: imagePath ?? null, archivedAt: null },
  });
  const told = await announceEvent(created.id);
  refresh(slug);
  return {
    ok: true,
    message: told.announcedTo
      ? `Event created and ${told.announcedTo} client${told.announcedTo === 1 ? "" : "s"} told about it.`
      : "Event created. Switch it on when you're ready and your clients will be told.",
  };
}

// The on/off switch.
export async function setEventActive(id: string, active: boolean): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  const event = await prisma.event.update({ where: { id }, data: { active } });
  const told = active ? await announceEvent(id) : { announcedTo: 0 };
  refresh(event.slug);
  revalidatePath("/client");
  revalidatePath("/client/events");
  return {
    ok: true,
    message: !active
      ? "Event taken off the site."
      : told.announcedTo
        ? `Event is live, and ${told.announcedTo} client${told.announcedTo === 1 ? "" : "s"} have been told.`
        : "Event is live on the site.",
  };
}

// Put it back on the site after it was archived (e.g. the date moved).
export async function unarchiveEvent(id: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  const event = await prisma.event.update({ where: { id }, data: { archivedAt: null } });
  refresh(event.slug);
  return { ok: true, message: "Event restored." };
}

export async function deleteEvent(id: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return { ok: false, error: "That event no longer exists." };
  await deleteUpload(event.imagePath);
  await prisma.event.delete({ where: { id } }); // signups cascade
  refresh(event.slug);
  return { ok: true, message: "Event deleted." };
}

// Take someone off the list (they've dropped out, or it was a mistake).
export async function removeSignup(signupId: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  const signup = await prisma.eventSignup.findUnique({
    where: { id: signupId },
    include: { event: { select: { slug: true } } },
  });
  if (!signup) return { ok: false, error: "That booking has already gone." };

  // Take the fee back off their invoice first - refused if it's already paid.
  const unbilled = await removeEventSignupFromInvoice(signupId);
  if (!unbilled.ok) return { ok: false, error: unbilled.error };

  await prisma.eventSignup.delete({ where: { id: signupId } });
  refresh(signup.event.slug);
  revalidatePath("/client/invoices");
  return {
    ok: true,
    message: unbilled.removed
      ? `${signup.name} removed, and the fee taken off their invoice.`
      : `${signup.name} removed from the list.`,
  };
}
