import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getSession } from "@/lib/auth";
import {
  getServices,
  requestedWalkOptions,
  DAY_NAMES,
  SLOT_WORDS,
} from "@/lib/services";
import { RegisterForm, type SlotGroup } from "./RegisterForm";

export default async function RegisterPage() {
  if (await getSession()) redirect("/dashboard");

  // Build the registration slots from the admin's live services.
  const services = await getServices();
  const slotGroups: SlotGroup[] = services
    .filter((s) => s.active)
    .map((s) => ({
      name: s.name,
      timeSlotLabel: SLOT_WORDS[s.timeSlot] ?? s.timeSlot,
      // Same option values the admin sees on the approvals card.
      options: requestedWalkOptions([s]).map((o) => ({
        value: o.value,
        day: DAY_NAMES[o.day] ?? `Day ${o.day}`,
      })),
    }))
    .filter((g) => g.options.length > 0);
  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
      <div className="mb-6 flex items-center justify-between">
        <Logo className="text-xl" />
        <Link href="/login" className="btn-ghost">
          Log in
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">Create your account</h1>
        <p className="mt-1 text-muted">
          Tell us about you and your dog(s). An admin will review and approve
          your account, then you can add a card and start booking.
        </p>
      </div>
      <RegisterForm slotGroups={slotGroups} />
    </div>
  );
}
