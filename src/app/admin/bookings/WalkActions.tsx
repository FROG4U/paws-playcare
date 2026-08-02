"use client";

import { useState, useTransition } from "react";
import { completeWalk, undoComplete } from "./actions";

export function CompleteButton({ walkId }: { walkId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await completeWalk(walkId);
            if (!res.ok) setError(res.error);
          })
        }
      >
        {pending ? "Saving…" : "Mark completed"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

export function UndoButton({ walkId }: { walkId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        className="btn-ghost text-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await undoComplete(walkId);
            if (!res.ok) setError(res.error);
          })
        }
      >
        {pending ? "…" : "Undo"}
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
