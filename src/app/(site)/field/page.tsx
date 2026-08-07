import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { getFieldSettings } from "@/lib/field";
import { stripeConfigured } from "@/lib/stripe";
import { PageHero } from "@/components/site";
import { monthView } from "./actions";
import { FieldBooking } from "./FieldBooking";

export const metadata: Metadata = {
  title: "Book the playground — Paws Playcare Watford",
  description:
    "Hire our private, secure dog playground by the hour. Book online, pay by card and get your gate access codes by email straight away.",
};

export const dynamic = "force-dynamic";

export default async function FieldPage() {
  const now = new Date();
  const [settings, user, initial] = await Promise.all([
    getFieldSettings(),
    getCurrentUser(),
    monthView(now.getUTCFullYear(), now.getUTCMonth() + 1),
  ]);

  const fieldClient =
    user?.role === ROLES.FIELD_CLIENT
      ? { name: user.name, email: user.email, phone: user.phone ?? "", carReg: user.carReg ?? "" }
      : null;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

  return (
    <>
      <PageHero
        heading="Book the playground"
        sub="Our private, secure field — hire it by the hour and get instant access codes by email"
      />
      <div className="mx-auto w-full max-w-3xl px-5 py-10">
        <FieldBooking
          initialYear={now.getUTCFullYear()}
          initialMonth={now.getUTCMonth() + 1}
          initialDays={initial.days}
          slotPrice={initial.slotPrice}
          publishableKey={publishableKey}
          payEnabled={stripeConfigured() && !!publishableKey}
          fieldClient={fieldClient}
          seasonInfo={{
            summer: { open: settings.summerOpenHour, close: settings.summerCloseHour },
            winter: { open: settings.winterOpenHour, close: settings.winterCloseHour },
          }}
        />
      </div>
    </>
  );
}
