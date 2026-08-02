"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS } from "@/lib/constants";
import {
  createSetupIntent,
  saveCardFromSetupIntent,
  stripeConfigured,
} from "@/lib/stripe";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

// Start a SetupIntent and hand the client secret to Stripe Elements.
export async function startCardSetup(): Promise<Result<{ clientSecret: string }>> {
  if (!stripeConfigured()) {
    return { ok: false, error: "Card payments aren't set up yet. Please contact us." };
  }
  const user = await requireRole([ROLES.CLIENT]);
  if (user.status !== USER_STATUS.ACTIVE) {
    return { ok: false, error: "Your account needs to be approved before you can add a card." };
  }
  const si = await createSetupIntent(user.id);
  if (!si.client_secret) {
    return { ok: false, error: "Couldn't start card setup. Please try again." };
  }
  return { ok: true, clientSecret: si.client_secret };
}

// After Stripe confirms the card on the client, cache it against the user.
export async function saveCard(setupIntentId: string): Promise<Result<{}>> {
  if (!stripeConfigured()) {
    return { ok: false, error: "Card payments aren't set up yet." };
  }
  const user = await requireRole([ROLES.CLIENT]);
  try {
    await saveCardFromSetupIntent(user.id, setupIntentId);
  } catch {
    return { ok: false, error: "We couldn't save that card. Please try again." };
  }
  revalidatePath("/client/payment");
  revalidatePath("/client");
  return { ok: true };
}

// Forget the saved card (client can re-add another). Keeps the Stripe customer.
export async function removeCard(): Promise<Result<{}>> {
  const user = await requireRole([ROLES.CLIENT]);
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
  revalidatePath("/client/payment");
  revalidatePath("/client");
  return { ok: true };
}
