"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { requestWalkCancellation } from "./actions";

// Cancel control for one upcoming walk. Warns about the charge when the walk is
// within 7 days, then creates a request the admin must approve.
export function CancelWalk({
  walkId,
  within7,
  price,
  pending: alreadyRequested,
}: {
  walkId: string;
  within7: boolean;
  price: number;
  pending: boolean;
}) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (alreadyRequested) {
    return <span className="badge bg-warn/15 text-warn">Cancellation requested</span>;
  }

  function onClick() {
    const msg = within7
      ? `This walk is within 7 days, so you'll still be charged the full price (${formatMoney(price)}) even once it's cancelled. Ask to cancel anyway?`
      : "Ask to cancel this walk? It needs to be approved by the team — you'll be notified.";
    if (!window.confirm(msg)) return;
    setError(null);
    start(async () => {
      const res = await requestWalkCancellation(walkId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end">
      <button onClick={onClick} disabled={busy} className="text-sm font-semibold text-danger hover:underline">
        {busy ? "Sending…" : "Cancel"}
      </button>
      {error && <span className="mt-0.5 text-xs text-danger">{error}</span>}
    </div>
  );
}
