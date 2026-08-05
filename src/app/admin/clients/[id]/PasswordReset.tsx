"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { resetClientPassword } from "./actions";

export function PasswordReset({ clientId }: { clientId: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function save() {
    setError(null);
    setDone(null);
    start(async () => {
      const res = await resetClientPassword(clientId, pw);
      if (res.ok) {
        setDone(pw);
        setOpen(false);
      } else {
        setError(res.error);
      }
    });
  }

  if (!open) {
    return (
      <div className="mt-3 border-t border-border pt-3">
        {done ? (
          <p className="text-sm font-medium text-success">
            Password set to <span className="font-mono">{done}</span> — the client can log in with it now.
          </p>
        ) : (
          <button className="btn-ghost" onClick={() => setOpen(true)}>
            <Icon name="shield" className="h-4 w-4" />
            Set / reset login password
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2 border-t border-border pt-3">
      <p className="text-sm font-semibold">Set a new login password</p>
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          className="input max-w-[16rem]"
          placeholder="At least 8 characters"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <button className="btn-primary" disabled={pending || pw.trim().length < 8} onClick={save}>
          {pending ? "Saving…" : "Save password"}
        </button>
        <button className="btn-ghost" disabled={pending} onClick={() => { setOpen(false); setError(null); }}>
          Cancel
        </button>
      </div>
      <p className="text-xs text-muted">Share this password with the client — they can change it later.</p>
    </div>
  );
}
