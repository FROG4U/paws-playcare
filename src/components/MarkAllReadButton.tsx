"use client";

import { useTransition } from "react";
import { markAllRead } from "@/app/actions/notifications";

export function MarkAllReadButton({ path }: { path: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-outline"
      disabled={pending}
      onClick={() => start(() => markAllRead(path))}
    >
      Mark all read
    </button>
  );
}
