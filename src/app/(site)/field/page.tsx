import type { Metadata } from "next";
import Link from "next/link";
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

  const isFieldClient = user?.role === ROLES.FIELD_CLIENT;
  const fieldClient = isFieldClient
    ? { name: user!.name, email: user!.email, phone: user!.phone ?? "", carReg: user!.carReg ?? "" }
    : null;
  // A logged-in dog-walking client can also book the field — prefill their
  // details (they book as a guest; it isn't tied to their dog-walking account).
  const prefill =
    user && user.role === ROLES.CLIENT
      ? { name: user.name, email: user.email, phone: user.phone ?? "", carReg: "" }
      : null;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";

  return (
    <>
      <PageHero
        heading="Book the playground"
        sub="Our private, secure field — hire it by the hour and get instant access codes by email"
      />
      <div className="mx-auto w-full max-w-3xl px-5 py-10">
        {!user && (
          <p className="mb-4 text-right text-sm text-muted">
            Booked with us before?{" "}
            <Link href="/field/login" className="font-semibold text-brand">
              Log in to your field account
            </Link>
          </p>
        )}
        <FieldBooking
          initialYear={now.getUTCFullYear()}
          initialMonth={now.getUTCMonth() + 1}
          initialDays={initial.days}
          slotPrice={initial.slotPrice}
          publishableKey={publishableKey}
          payEnabled={stripeConfigured() && !!publishableKey}
          fieldClient={fieldClient}
          prefill={prefill}
          seasonInfo={{
            summer: { open: settings.summerOpenHour, close: settings.summerCloseHour },
            winter: { open: settings.winterOpenHour, close: settings.winterCloseHour },
          }}
        />
      </div>
    </>
  );
}
