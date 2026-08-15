"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { resolveCancellation } from "./actions";

export function CancellationActions({
  requestId,
  late,
  priceLabel,
}: {
  requestId: string;
  late: boolean;
  priceLabel: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (approve: boolean, charge = true) =>
    start(async () => {
      setError(null);
      const res = await resolveCancellation(requestId, approve, charge);
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="flex flex-col items-end gap-1.5">
      {late ? (
        // Within 7 days — let the admin choose to collect the fee or waive it.
        <div className="flex flex-wrap justify-end gap-2">
          <button className="btn-primary" disabled={pending} onClick={() => run(true, true)}>
            <Icon name="check" className="h-4 w-4" />
            Approve &amp; charge {priceLabel}
          </button>
          <button className="btn-outline" disabled={pending} onClick={() => run(true, false)}>
            Approve &amp; waive (no charge)
          </button>
          <button className="btn-ghost" disabled={pending} onClick={() => run(false)}>
            Decline
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button className="btn-primary" disabled={pending} onClick={() => run(true)}>
            <Icon name="check" className="h-4 w-4" />
            Approve cancel
          </button>
          <button className="btn-ghost" disabled={pending} onClick={() => run(false)}>
            Decline
          </button>
        </div>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
