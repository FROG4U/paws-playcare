import Link from "next/link";
import { requireClient } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PAY_CADENCE } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ProfileForm, EditMyDogForm, AddDogForm, UnarchiveDog } from "./ProfileForms";

const CADENCE_LABEL: Record<string, string> = {
  [PAY_CADENCE.DAILY]: "Daily",
  [PAY_CADENCE.WEEKLY]: "Weekly",
  [PAY_CADENCE.MONTHLY]: "Monthly",
};

export default async function ProfilePage() {
  const user = await requireClient();
  const dogs = await prisma.dog.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "asc" },
  });
  const activeDogs = dogs.filter((d) => !d.archivedAt);
  const archivedDogs = dogs.filter((d) => d.archivedAt);

  return (
    <div className="space-y-6">
      <PageHeader icon="user" title="My profile" subtitle="Update your details, and manage your dogs — any time." />

      {/* Contact details */}
      <ProfileForm
        profile={{
          name: user.name,
          email: user.email,
          phone: user.phone,
          address: user.address,
          emergencyName: user.emergencyName,
          emergencyPhone: user.emergencyPhone,
        }}
      />

      {/* Billing cycle (read-only) + T&C */}
      <div className="card space-y-3">
        <h2 className="text-lg font-bold">Billing &amp; terms</h2>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-background px-3 py-2.5">
          <div>
            <p className="text-sm text-muted">Payment cycle</p>
            <p className="font-semibold">{CADENCE_LABEL[user.payCadence] ?? user.payCadence}</p>
          </div>
          <p className="text-xs text-muted">To change your billing cycle, please contact us.</p>
        </div>
        <div className="rounded-lg bg-background px-3 py-2.5 text-sm">
          {user.agreedTermsAt ? (
            <p>
              You agreed to our{" "}
              <Link href="/terms" className="font-semibold text-brand underline">Terms &amp; Conditions</Link>{" "}
              on <span className="font-semibold">{formatDateTime(user.agreedTermsAt)}</span>.
            </p>
          ) : (
            <p className="text-muted">
              No terms agreement on record. See our{" "}
              <Link href="/terms" className="font-semibold text-brand underline">Terms &amp; Conditions</Link>.
            </p>
          )}
        </div>
      </div>

      {/* Dogs */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Icon name="paw" className="h-5 w-5 text-brand" /> My dogs
          </h2>
          <AddDogForm />
        </div>

        {activeDogs.length === 0 && (
          <p className="text-sm text-muted">No active dogs. Add one to start booking walks.</p>
        )}
        {activeDogs.map((dog) => (
          <EditMyDogForm key={dog.id} dog={dog} />
        ))}

        {archivedDogs.length > 0 && (
          <div className="card space-y-2">
            <p className="text-sm font-bold uppercase tracking-wide text-muted">Archived</p>
            {archivedDogs.map((dog) => (
              <div key={dog.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted line-through">{dog.name}</span>
                <UnarchiveDog dogId={dog.id} name={dog.name} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
