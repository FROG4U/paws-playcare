"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerWorker } from "@/app/actions/registerWorker";

export function WorkerForm({
  token,
  presetName,
  presetEmail,
}: {
  token: string;
  presetName?: string | null;
  presetEmail?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: presetName || "",
    email: presetEmail || "",
    password: "",
    phone: "",
  });

  function submit() {
    setError(null);
    start(async () => {
      const res = await registerWorker({ token, ...form });
      if (res.ok) router.push("/worker");
      else setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <label className="label">Full name</label>
        <input
          className="input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Email</label>
        <input
          type="email"
          className="input"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Phone</label>
        <input
          className="input"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
      </div>
      <div>
        <label className="label">Password</label>
        <input
          type="password"
          className="input"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="At least 8 characters"
        />
      </div>
      <button
        onClick={submit}
        disabled={pending}
        className="btn-primary w-full py-3"
      >
        {pending ? "Creating account…" : "Create walker account"}
      </button>
    </div>
  );
}
