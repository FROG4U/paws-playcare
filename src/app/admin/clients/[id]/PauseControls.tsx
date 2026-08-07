"use client";

import { useTransition } from "react";
import { pauseClientWalks, resumeClientWalks, dismissPauseRequest } from "./actions";
import { Icon } from "@/components/Icon";

export function PauseControls({
  clientId,
  requested,
  reason,
  requestedAt,
  pausedCount,
}: {
  clientId: string;
  requested: boolean;
  reason: string | null;
  requestedAt: string | null;
  pausedCount: number;
}) {
  const [pending, start] = useTransition();

  // A pending pause request from the client — needs an admin decision.
  if (requested) {
    return (
      <div className="rounded-xl border border-warn/40 bg-warn/10 p-4">
        <div className="flex items-start gap-2">
          <Icon name="clock" className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
          <div className="flex-1">
            <p className="font-bold">Pause requested</p>
            {requestedAt && <p className="text-xs text-muted">Asked {requestedAt}</p>}
            {reason && <p className="mt-1 text-sm text-muted">“{reason}”</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="btn-primary"
            disabled={pending}
            onClick={() => start(async () => { await pauseClientWalks(clientId); })}
          >
            {pending ? "Pausing…" : "Pause walks"}
          </button>
          <button
            className="btn-ghost"
            disabled={pending}
            onClick={() => start(async () => { await dismissPauseRequest(clientId); })}
          >
            Dismiss request
          </button>
        </div>
      </div>
    );
  }

  // Already paused — offer to resume.
  if (pausedCount > 0) {
    return (
      <div className="rounded-xl border border-border bg-mist p-4">
        <p className="font-bold">Walks paused</p>
        <p className="text-sm text-muted">
          {pausedCount} booking{pausedCount > 1 ? "s" : ""} paused — upcoming walks were cancelled with no charge.
        </p>
        <button
          className="btn-primary mt-3"
          disabled={pending}
          onClick={() => start(async () => { await resumeClientWalks(clientId); })}
        >
          {pending ? "Resuming…" : "Resume walks"}
        </button>
      </div>
    );
  }

  // Nothing pending — admin can still pause proactively.
  return (
    <button
      className="btn-outline"
      disabled={pending}
      onClick={() => start(async () => { await pauseClientWalks(clientId); })}
    >
      Pause this client’s walks
    </button>
  );
}
