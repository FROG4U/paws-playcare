"use client";

import { useTransition } from "react";
import { setServicesPaused } from "@/app/actions/client";

export function PauseToggle({ paused }: { paused: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      className={paused ? "btn-primary" : "btn-outline"}
      disabled={pending}
      onClick={() => start(() => setServicesPaused(!paused))}
    >
      {paused ? "Resume walks" : "Pause all walks"}
    </button>
  );
}
