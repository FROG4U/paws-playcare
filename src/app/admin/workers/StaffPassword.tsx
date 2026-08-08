"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/Icon";
import { setStaffPassword } from "./actions";

// Lets an admin set/reset a team member's login password from the app — no
// email or command line. Used to recover a locked-out admin (e.g. Kitty).
export function StaffPassword({ userId, name }: { userId: string; name: string }) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function save() {
    setError(null);
    start(async () => {
      const res = await setStaffPassword(userId, pw);
      if (res.ok) {
        setDone(pw);
        setOpen(false);
        setPw("");
      } else {
        setError(res.error);
      }
    });
  }

  if (done) {
    return (
      <p className="text-sm font-medium text-success">
        Password set — {name.split(" ")[0]} can log in at /PPC now.
      </p>
    );
  }

  if (!open) {
    return (
      <button className="btn-ghost text-sm" onClick={() => setOpen(true)}>
        <Icon name="shield" className="h-4 w-4" />
        Set password
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="New password (min 8)"
        className="input w-48"
      />
      <button className="btn-primary" disabled={pending || pw.length < 8} onClick={save}>
        {pending ? "Saving…" : "Save"}
      </button>
      <button className="btn-ghost" onClick={() => { setOpen(false); setPw(""); setError(null); }}>
        Cancel
      </button>
      {error && <span className="text-sm text-danger">{error}</span>}
    </div>
  );
}
