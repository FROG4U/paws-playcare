import { prisma } from "@/lib/prisma";
import { CHANGE_REQUEST_TYPE, CHANGE_REQUEST_STATUS } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getServices } from "@/lib/services";
import { serviceColorMap } from "@/lib/service-colors";
import { PageHeader, EmptyState } from "@/components/ui";
import { ServiceBadge } from "@/components/ServiceBadge";
import { CancellationActions } from "./CancellationActions";

export default async function CancellationsPage() {
  const [requests, colorMap] = await Promise.all([
    prisma.changeRequest.findMany({
      where: { type: CHANGE_REQUEST_TYPE.CANCELLATION, status: CHANGE_REQUEST_STATUS.PENDING },
      include: {
        walk: { include: { client: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    getServices().then(serviceColorMap),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        icon="x"
        title="Cancellation requests"
        subtitle="Approve or decline. Cancellations within 7 days are still charged — you don't lose out."
      />

      {requests.length === 0 && (
        <EmptyState icon="check" title="Nothing to review">
          When a client asks to cancel an upcoming walk, it&apos;ll appear here for approval.
        </EmptyState>
      )}

      {requests.map((r) => {
        const w = r.walk;
        const colorIndex = w.serviceName != null ? colorMap[w.serviceName] ?? null : null;
        return (
          <div key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <p className="flex items-center gap-2 font-semibold">
                <ServiceBadge name={w.serviceName ?? "Walk"} colorIndex={colorIndex} />
                {formatDate(w.date)}
              </p>
              <p className="text-sm text-muted">
                {w.client.name} · {w.numDogs} dog{w.numDogs !== 1 ? "s" : ""} · {formatMoney(w.price)}
              </p>
              {r.feeApplies ? (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-warn/15 px-2.5 py-0.5 text-xs font-bold text-warn">
                  Within 7 days — you&apos;ll still be paid {formatMoney(w.price)}
                </p>
              ) : (
                <p className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-bold text-success">
                  7+ days&apos; notice — no charge
                </p>
              )}
              <p className="text-xs text-muted">Requested {formatDate(r.createdAt)}</p>
            </div>
            <CancellationActions requestId={r.id} />
          </div>
        );
      })}
    </div>
  );
}
