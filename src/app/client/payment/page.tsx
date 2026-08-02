import { requireClient } from "@/lib/guard";
import { USER_STATUS } from "@/lib/constants";
import { stripeConfigured } from "@/lib/stripe";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { PaymentClient } from "./PaymentClient";

export default async function PaymentPage() {
  const user = await requireClient();

  const card = user.paymentMethodId
    ? {
        brand: user.cardBrand,
        last4: user.cardLast4,
        expMonth: user.cardExpMonth,
        expYear: user.cardExpYear,
      }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon="card"
        title="Payment"
        subtitle="Add a card and we'll collect payment automatically after each completed walk."
      />

      {user.status !== USER_STATUS.ACTIVE ? (
        <div className="card flex items-start gap-3">
          <Icon name="clock" className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <div>
            <p className="font-bold">Account awaiting approval</p>
            <p className="text-sm text-muted">
              You&apos;ll be able to add a payment card as soon as an admin
              approves your account.
            </p>
          </div>
        </div>
      ) : !stripeConfigured() ? (
        <div className="card flex items-start gap-3">
          <Icon name="ban" className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div>
            <p className="font-bold">Card payments aren&apos;t set up yet</p>
            <p className="text-sm text-muted">
              Please check back shortly, or get in touch and we&apos;ll sort it
              out.
            </p>
          </div>
        </div>
      ) : (
        <PaymentClient
          publishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
          card={card}
        />
      )}

      <p className="text-center text-xs text-muted">
        <Icon name="shield" className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
        Card details are handled securely by Stripe. We never see or store your
        full card number.
      </p>
    </div>
  );
}
