"use client";

import { useTransition } from "react";
import { approveClient, rejectClient } from "./actions";

export function ApprovalButtons({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() => start(() => approveClient(userId))}
      >
        Approve
      </button>
      <button
        className="btn-outline"
        disabled={pending}
        onClick={() => {
          const reason = window.prompt("Reason for declining (optional)") || "";
          start(() => rejectClient(userId, reason));
        }}
      >
        Decline
      </button>
    </div>
  );
}
