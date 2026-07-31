import Stripe from "stripe";
import { prisma } from "./prisma";

let _stripe: Stripe | null = null;

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_NOT_CONFIGURED");
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Ensure the client has a Stripe customer; returns the customer id.
export async function ensureCustomer(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("USER_NOT_FOUND");
  if (user.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name,
    metadata: { userId: user.id },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { stripeCustomerId: customer.id },
  });
  return customer.id;
}

// SetupIntent so the client can save a card for off-session charging.
export async function createSetupIntent(userId: string) {
  const stripe = getStripe();
  const customerId = await ensureCustomer(userId);
  return stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
  });
}

// After a SetupIntent succeeds, cache the card + set it as default.
export async function saveCardFromSetupIntent(
  userId: string,
  setupIntentId: string
) {
  const stripe = getStripe();
  const si = await stripe.setupIntents.retrieve(setupIntentId);
  const pmId =
    typeof si.payment_method === "string"
      ? si.payment_method
      : si.payment_method?.id;
  if (!pmId) throw new Error("NO_PAYMENT_METHOD");

  const pm = await stripe.paymentMethods.retrieve(pmId);
  const customerId = await ensureCustomer(userId);

  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: pmId },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      paymentMethodId: pmId,
      cardBrand: pm.card?.brand ?? null,
      cardLast4: pm.card?.last4 ?? null,
      cardExpMonth: pm.card?.exp_month ?? null,
      cardExpYear: pm.card?.exp_year ?? null,
      cardExpiryNotifiedAt: null,
    },
  });
  return pm;
}

// Charge an amount (pence) off-session against the client's saved card.
export async function chargeOffSession(params: {
  userId: string;
  amount: number;
  description: string;
  idempotencyKey?: string;
}) {
  const stripe = getStripe();
  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user?.stripeCustomerId || !user.paymentMethodId) {
    throw new Error("NO_CARD_ON_FILE");
  }
  return stripe.paymentIntents.create(
    {
      amount: params.amount,
      currency: "gbp",
      customer: user.stripeCustomerId,
      payment_method: user.paymentMethodId,
      off_session: true,
      confirm: true,
      description: params.description,
    },
    params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined
  );
}
