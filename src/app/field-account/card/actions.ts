"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/constants";
import {
  createSetupIntent,
  saveCardFromSetupIntent,
  stripeConfigured,
} from "@/lib/stripe";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

export async function startCardSetup(): Promise<Result<{ clientSecret: string }>> {
  if (!stripeConfigured()) {
    return { ok: false, error: "Card payments aren't set up yet. Please contact us." };
  }
  const user = await requireRole([ROLES.FIELD_CLIENT]);
  const si = await createSetupIntent(user.id);
  if (!si.client_secret) {
    return { ok: false, error: "Couldn't start card setup. Please try again." };
  }
  return { ok: true, clientSecret: si.client_secret };
}

export async function saveCard(setupIntentId: string): Promise<Result<Record<string, unknown>>> {
  if (!stripeConfigured()) return { ok: false, error: "Card payments aren't set up yet." };
  const user = await requireRole([ROLES.FIELD_CLIENT]);
  try {
    await saveCardFromSetupIntent(user.id, setupIntentId);
  } catch {
    return { ok: false, error: "We couldn't save that card. Please try again." };
  }
  revalidatePath("/field-account/card");
  revalidatePath("/field-account");
  return { ok: true };
}

export async function removeCard(): Promise<Result<Record<string, unknown>>> {
  const user = await requireRole([ROLES.FIELD_CLIENT]);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      paymentMethodId: null,
      cardBrand: null,
      cardLast4: null,
      cardExpMonth: null,
      cardExpYear: null,
      cardExpiryNotifiedAt: null,
    },
  });
  revalidatePath("/field-account/card");
  revalidatePath("/field-account");
  return { ok: true };
}
