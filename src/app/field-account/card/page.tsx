import { getCurrentUser } from "@/lib/auth";
import { stripeConfigured } from "@/lib/stripe";
import { FieldCardClient } from "./FieldCardClient";

export const dynamic = "force-dynamic";

export default async function FieldCardPage() {
  const user = (await getCurrentUser())!;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
  const ready = stripeConfigured() && !!publishableKey;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold">Payment</h1>
        <p className="text-muted">Save a card for faster field bookings.</p>
      </div>
      {ready ? (
        <FieldCardClient
          publishableKey={publishableKey}
          card={{
            brand: user.cardBrand,
            last4: user.cardLast4,
            expMonth: user.cardExpMonth,
            expYear: user.cardExpYear,
          }}
        />
      ) : (
        <div className="card text-sm text-muted">Card payments aren&apos;t set up yet.</div>
      )}
    </div>
  );
}
