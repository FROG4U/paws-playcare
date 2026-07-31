import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { BOOKING_SLOT_LABELS } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ApprovalButtons } from "./ApprovalButtons";

export default async function ApprovalsPage() {
  const pending = await prisma.user.findMany({
    where: { role: ROLES.CLIENT, status: USER_STATUS.PENDING },
    include: { dogs: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        icon="check"
        title="Account approvals"
        subtitle="New clients can't book until you approve them."
      />

      {pending.length === 0 && (
        <EmptyState icon="check" title="All caught up">
          No accounts are waiting for approval right now.
        </EmptyState>
      )}

      {pending.map((c) => (
        <div key={c.id} className="card space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">{c.name}</h2>
              <p className="text-sm text-muted">
                {c.email}
                {c.phone ? ` · ${c.phone}` : ""}
              </p>
              <p className="mt-1 text-xs text-muted">
                Registered {formatDate(c.createdAt)} · pays{" "}
                <span className="capitalize">
                  {c.payCadence.toLowerCase()}
                </span>
              </p>
            </div>
            <ApprovalButtons userId={c.id} />
          </div>

          {c.address && (
            <p className="text-sm">
              <span className="text-muted">Address:</span> {c.address}
            </p>
          )}
          {(c.emergencyName || c.emergencyPhone) && (
            <p className="text-sm">
              <span className="text-muted">Emergency:</span> {c.emergencyName}{" "}
              {c.emergencyPhone}
            </p>
          )}

          {(() => {
            let reqSlots: string[] = [];
            try {
              reqSlots = JSON.parse(c.regSlots || "[]");
            } catch {}
            if (reqSlots.length === 0 && !c.regStartDate) return null;
            return (
              <div className="rounded-lg bg-brand-soft/60 p-3 text-sm">
                <p className="font-semibold">Requested walks</p>
                {reqSlots.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {reqSlots.map((s) => (
                      <span key={s} className="badge bg-surface text-brand-dark">
                        {BOOKING_SLOT_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                )}
                {c.regStartDate && (
                  <p className="mt-1 text-muted">
                    Preferred start: {formatDate(c.regStartDate)}
                  </p>
                )}
              </div>
            );
          })()}

          <div className="grid gap-2 sm:grid-cols-2">
            {c.dogs.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-border bg-background/40 p-3 text-sm"
              >
                <p className="flex items-center gap-1.5 font-bold">
                  <Icon name="paw" className="h-4 w-4 text-brand" />
                  {d.name}
                  {d.breed ? ` · ${d.breed}` : ""}
                  {d.age ? ` · ${d.age}` : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {tag(d.neutered, "Neutered")}
                  {tag(d.vaccinationsCurrent, "Vaccinated")}
                  {tag(d.microchipped, "Microchipped")}
                  {warn(d.aggressionPeople, "Aggression: people")}
                  {warn(d.aggressionAnimals, "Aggression: animals")}
                  {warn(d.historyBiting, "Bite history")}
                  {warn(d.medicalConditions, "Medical")}
                  {warn(d.fenceJumping, "Jumps fences")}
                </div>
                {d.allergies && (
                  <p className="mt-1 text-xs text-muted">
                    Allergies: {d.allergies}
                  </p>
                )}
                {d.triggers && (
                  <p className="text-xs text-muted">Triggers: {d.triggers}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function tag(on: boolean, label: string) {
  if (!on) return null;
  return (
    <span className="badge bg-brand-soft text-brand-dark">
      <Icon name="check" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
function warn(on: boolean, label: string) {
  if (!on) return null;
  return (
    <span className="badge bg-warn/15 text-warn">
      <Icon name="alert" className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
