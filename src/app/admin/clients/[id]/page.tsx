import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS, BOOKING_SLOT_LABELS } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Icon } from "@/components/Icon";
import { ClientActions } from "./ClientActions";
import { PauseControls } from "./PauseControls";
import { PasswordReset } from "./PasswordReset";
import { CadenceSelect } from "./CadenceSelect";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success",
  PENDING: "bg-warn/15 text-warn",
  SUSPENDED: "bg-danger/10 text-danger",
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await prisma.user.findUnique({
    where: { id },
    include: {
      dogs: { orderBy: { createdAt: "asc" } },
      _count: { select: { bookings: true, invoices: true, walksAsClient: true } },
    },
  });
  if (!client || client.role !== ROLES.CLIENT) notFound();

  const [lateCancels, pausedBookings] = await Promise.all([
    prisma.walk.count({ where: { clientId: id, lateCancelled: true } }),
    prisma.booking.count({ where: { clientId: id, status: "PAUSED" } }),
  ]);
  const archived = !!client.archivedAt;
  const hasCard = !!client.paymentMethodId;
  let regSlots: string[] = [];
  try {
    regSlots = JSON.parse(client.regSlots || "[]");
  } catch {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/clients" className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:bg-brand-soft" aria-label="Back to clients">
            <Icon name="chevronRight" className="h-5 w-5 rotate-180" />
          </Link>
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-soft text-base font-bold text-brand-dark">
            {client.name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{client.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <span className={`badge ${STATUS_BADGE[client.status] ?? "bg-border text-muted"}`}>
                {client.status.toLowerCase()}
              </span>
              {archived && <span className="badge bg-border text-muted">archived</span>}
              {lateCancels > 0 && (
                <span className="badge bg-danger/10 text-danger">
                  {lateCancels} late cancellation{lateCancels > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/admin/clients/${client.id}/edit`} className="btn-outline">
            <Icon name="pencil" className="h-4 w-4" /> Edit
          </Link>
          <ClientActions id={client.id} name={client.name} archived={archived} />
        </div>
      </div>

      {/* Pause request / paused state */}
      <PauseControls
        clientId={client.id}
        requested={!!client.pauseRequestedAt}
        reason={client.pauseRequestReason}
        requestedAt={client.pauseRequestedAt ? formatDateTime(client.pauseRequestedAt) : null}
        pausedCount={pausedBookings}
      />

      {/* Snapshot counts */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat icon="paw" label="Dogs" value={client.dogs.length} />
        <Stat icon="calendar" label="Walks" value={client._count.walksAsClient} />
        <Stat icon="receipt" label="Invoices" value={client._count.invoices} />
        <Stat icon="clock" label="Billing" value={client.payCadence.toLowerCase()} />
      </div>

      {/* Account */}
      <Section title="Account" icon="user">
        <Field label="Email" value={client.email} />
        <Field label="Phone" value={client.phone} />
        <Field label="Member since" value={formatDate(client.createdAt)} />
        <Field label="Status" value={client.status.toLowerCase()} />
        {client.approvedAt && <Field label="Approved" value={formatDate(client.approvedAt)} />}
        {client.status === USER_STATUS.SUSPENDED && client.suspendReason && (
          <Field label="On hold" value={client.suspendReason} />
        )}
        <Field
          label="Walks"
          value={
            pausedBookings > 0
              ? "Paused"
              : client.pauseRequestedAt
              ? "Pause requested"
              : "Active"
          }
        />
        <Field
          label="Card on file"
          value={hasCard ? `${client.cardBrand ?? "Card"} ···· ${client.cardLast4} · exp ${String(client.cardExpMonth).padStart(2, "0")}/${String(client.cardExpYear).slice(-2)}` : "No card"}
        />
        {lateCancels > 0 && (
          <Field label="Late cancellations" value={`${lateCancels} — charged in full (within-7-day notice)`} />
        )}
        <div className="py-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted/70">Billing cycle</p>
          <div className="mt-1"><CadenceSelect clientId={client.id} current={client.payCadence} /></div>
        </div>
        <PasswordReset clientId={client.id} />
      </Section>

      {/* Profile */}
      <Section title="Contact & profile" icon="mapPin">
        <Field label="Address" value={client.address} />
        <Field label="Emergency contact" value={client.emergencyName} />
        <Field label="Emergency phone" value={client.emergencyPhone} />
        <Field label="Notes" value={client.notes} />
      </Section>

      {/* Booking requirements from sign-up */}
      <Section title="Sign-up requirements" icon="clipboard">
        <Field label="Preferred start" value={client.regStartDate ? formatDate(client.regStartDate) : null} />
        <Field
          label="Requested slots"
          value={regSlots.length ? regSlots.map((s) => BOOKING_SLOT_LABELS[s] ?? s).join(", ") : null}
        />
        <Field label="Agreed to terms" value={client.agreedTermsAt ? formatDateTime(client.agreedTermsAt) : "Not recorded"} />
      </Section>

      {/* Dogs */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Icon name="paw" className="h-5 w-5 text-brand" />
          Dogs ({client.dogs.length})
        </h2>
        {client.dogs.length === 0 ? (
          <p className="card text-sm text-muted">No dogs on this account.</p>
        ) : (
          client.dogs.map((dog) => (
            <div key={dog.id} className="card space-y-3">
              <h3 className="text-lg font-bold">
                {dog.name}
                {dog.breed ? <span className="ml-2 text-sm font-normal text-muted">{dog.breed}</span> : null}
              </h3>
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <Field label="Age" value={dog.age} />
                <Field label="If under 1 year" value={dog.ageUnderOne} />
                <YesNo label="Neutered / spayed" v={dog.neutered} />
                <YesNo label="Microchipped" v={dog.microchipped} />
                <YesNo label="Insured" v={dog.insured} />
                <YesNo label="Vaccinations up to date" v={dog.vaccinationsCurrent} />
                <YesNo label="Kennel cough up to date" v={dog.kennelCoughCurrent} />
                <YesNo label="House trained" v={dog.houseTrained} />
              </div>

              <SubHead>Health & medical</SubHead>
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <Field label="Health details / medication" value={dog.healthDetails} full />
                <YesNo label="Medical conditions" v={dog.medicalConditions} />
                <Field label="Medical details" value={dog.medicalDetails} />
                <Field label="Allergies" value={dog.allergies} />
              </div>

              <SubHead>Behaviour & temperament</SubHead>
              <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <YesNo label="Socialises with other dogs" v={dog.socialises} />
                <YesNo label="Accepts treats" v={dog.acceptsTreats} />
                <YesNo label="Aggression to people" v={dog.aggressionPeople} danger />
                <YesNo label="Aggression to animals" v={dog.aggressionAnimals} danger />
                <YesNo label="History of biting" v={dog.historyBiting} danger />
                <YesNo label="History of growling" v={dog.historyGrowling} danger />
                <YesNo label="Fence jumping" v={dog.fenceJumping} danger />
                <YesNo label="Escape attempts" v={dog.escapeAttempts} danger />
                <YesNo label="Possessiveness" v={dog.possessiveness} danger />
                <YesNo label="Reacted negatively before" v={dog.reactedNegatively} danger />
                <Field label="Obedience notes" value={dog.obedienceNotes} />
                <Field label="Triggers" value={dog.triggers} />
                <Field label="Negative-reaction details" value={dog.negativeReactions} full />
                <Field label="Other notes" value={dog.otherNotes} full />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="card flex items-center gap-3 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon name={icon} className="h-[1.15rem] w-[1.15rem]" />
      </span>
      <div>
        <p className="text-lg font-bold capitalize leading-none">{value}</p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card space-y-2">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Icon name={icon} className="h-5 w-5 text-brand" />
        {title}
      </h2>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={`py-1 ${full ? "sm:col-span-2" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted/70">{label}</p>
      <p className={value ? "" : "text-muted/50"}>{value || "—"}</p>
    </div>
  );
}

function YesNo({ label, v, danger }: { label: string; v: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <p className="text-sm text-muted">{label}</p>
      <span className={`badge ${v ? (danger ? "bg-danger/10 text-danger" : "bg-success/15 text-success") : "bg-background text-muted"}`}>
        {v ? "Yes" : "No"}
      </span>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return <p className="border-t border-border pt-2 text-sm font-bold text-brand-dark">{children}</p>;
}
