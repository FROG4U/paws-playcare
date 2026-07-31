"use client";

import { useState, useTransition } from "react";
import { revokeInvite, toggleWorkerActive } from "./actions";

export function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/register/worker?token=${token}`
      : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copy this invite link:", link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        readOnly
        value={link}
        onFocus={(e) => e.currentTarget.select()}
        className="input flex-1 min-w-0 text-xs"
      />
      <button type="button" onClick={copy} className="btn-primary shrink-0">
        {copied ? "Copied ✓" : "Copy link"}
      </button>
    </div>
  );
}

export function RevokeButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="text-sm font-semibold text-danger"
      disabled={pending}
      onClick={() => start(() => revokeInvite(id))}
    >
      Revoke
    </button>
  );
}

export function WorkerActiveToggle({
  userId,
  active,
}: {
  userId: string;
  active: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      className={active ? "btn-outline" : "btn-primary"}
      disabled={pending}
      onClick={() => start(() => toggleWorkerActive(userId, !active))}
    >
      {active ? "Deactivate" : "Reactivate"}
    </button>
  );
}
