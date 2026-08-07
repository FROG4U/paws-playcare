import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { FIELD_COUPON_TYPE } from "@/lib/constants";
import { CouponForm, CouponActions } from "./CouponClient";

export const dynamic = "force-dynamic";

export default async function CouponsPage() {
  const coupons = await prisma.fieldCoupon.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Field discount codes</h1>
        <p className="text-muted">Codes customers can enter at checkout for the playground.</p>
      </div>

      <CouponForm />

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">All codes ({coupons.length})</h2>
        {coupons.length === 0 ? (
          <div className="card text-sm text-muted">No codes yet.</div>
        ) : (
          <div className="space-y-2">
            {coupons.map((c) => {
              const expired = c.expiresAt && c.expiresAt.getTime() < Date.now();
              const usedUp = c.maxUses != null && c.usedCount >= c.maxUses;
              return (
                <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">
                      {c.code}{" "}
                      <span className="ml-1 text-sm font-normal text-muted">
                        {c.type === FIELD_COUPON_TYPE.PERCENT ? `${c.value}% off` : `${formatMoney(c.value)} off`}
                      </span>
                    </p>
                    <p className="text-xs text-muted">
                      Used {c.usedCount}{c.maxUses != null ? ` / ${c.maxUses}` : ""}
                      {c.expiresAt ? ` · expires ${formatDate(c.expiresAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!c.active ? (
                      <span className="badge bg-muted/15 text-muted">Off</span>
                    ) : expired || usedUp ? (
                      <span className="badge bg-danger/15 text-danger">{expired ? "Expired" : "Used up"}</span>
                    ) : (
                      <span className="badge bg-success/15 text-success">Active</span>
                    )}
                    <CouponActions id={c.id} active={c.active} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
