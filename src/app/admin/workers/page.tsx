import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { createWorkerInvite } from "./actions";
import { CopyLink, RevokeButton, WorkerActiveToggle } from "./InviteControls";
import { StaffPassword } from "./StaffPassword";

export default async function TeamPage() {
  const team = await prisma.user.findMany({
    where: { role: { in: [ROLES.ADMIN, ROLES.WORKER] } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  const invites = await prisma.workerInvite.findMany({
    where: { usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  const now = new Date();

  return (
    <div className="space-y-6">
      <PageHeader
        icon="footprints"
        title="Team"
        subtitle="Admins are walkers by default. Invite new walkers with a link."
      />

      {/* Invite a worker */}
      <div className="card space-y-4">
        <h2 className="text-lg font-bold">Invite a walker</h2>
        <form action={createWorkerInvite} className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Name (optional)</label>
            <input name="name" className="input" placeholder="e.g. Sam Walker" />
          </div>
          <div>
            <label className="label">Email (optional)</label>
            <input name="email" type="email" className="input" placeholder="sam@example.com" />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-primary">Create invite link</button>
            <p className="mt-1.5 text-xs text-muted">
              Generates a shareable link (valid 14 days). Send it to the walker —
              they set their own password and their account is active straight
              away.
            </p>
          </div>
        </form>

        {invites.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-sm font-semibold">Pending invites</p>
            {invites.map((inv) => {
              const expired = inv.expiresAt < now;
              return (
                <div key={inv.id} className="rounded-lg border border-border p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm">
                      <span className="font-semibold">
                        {inv.name || inv.email || "Walker invite"}
                      </span>
                      <span className={`ml-2 badge ${expired ? "bg-danger/10 text-danger" : "bg-brand-soft text-brand-dark"}`}>
                        {expired ? "Expired" : `Expires ${formatDate(inv.expiresAt)}`}
                      </span>
                    </div>
                    <RevokeButton id={inv.id} />
                  </div>
                  {!expired && <CopyLink token={inv.token} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Team list */}
      <div className="card">
        <h2 className="text-lg font-bold">Team members</h2>
        <ul className="mt-3 divide-y divide-border">
          {team.map((m) => {
            const isAdmin = m.role === ROLES.ADMIN;
            const active = m.status === "ACTIVE";
            return (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-semibold">
                    {m.name}
                    <span className={`ml-2 badge ${isAdmin ? "bg-accent/15 text-accent" : "bg-brand-soft text-brand-dark"}`}>
                      {isAdmin ? "Admin · walker" : "Walker"}
                    </span>
                    {!active && (
                      <span className="ml-1 badge bg-danger/10 text-danger">
                        {m.status.toLowerCase()}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted">
                    {m.email}
                    {m.phone ? ` · ${m.phone}` : ""}
                  </p>
                  <div className="mt-1.5">
                    <StaffPassword userId={m.id} name={m.name} />
                  </div>
                </div>
                {!isAdmin && (
                  <WorkerActiveToggle userId={m.id} active={active} />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
