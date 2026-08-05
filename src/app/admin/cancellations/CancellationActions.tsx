"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { resolveCancellation } from "./actions";

export function CancellationActions({ requestId }: { requestId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (approve: boolean) =>
    start(async () => {
      setError(null);
      const res = await resolveCancellation(requestId, approve);
      if (!res.ok) setError(res.error);
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button className="btn-primary" disabled={pending} onClick={() => run(true)}>
          <Icon name="check" className="h-4 w-4" />
          Approve cancel
        </button>
        <button className="btn-ghost" disabled={pending} onClick={() => run(false)}>
          Decline
        </button>
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
