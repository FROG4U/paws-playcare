"use client";

import { useActionState, useState, useTransition } from "react";
import { createCoupon, toggleCoupon, deleteCoupon, type FormState } from "../actions";

export function CouponForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createCoupon, {});
  const [type, setType] = useState("PERCENT");
  return (
    <form action={action} className="card space-y-3">
      <h2 className="font-bold">New discount code</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Code</span>
          <input name="code" className="input uppercase" placeholder="SUMMER10" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Type</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="input">
            <option value="PERCENT">Percentage off</option>
            <option value="FIXED">Fixed amount off (£)</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            {type === "PERCENT" ? "Percent (1–100)" : "Amount off (£)"}
          </span>
          <input name="value" className="input" inputMode="decimal" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Max uses (blank = unlimited)</span>
          <input name="maxUses" type="number" min={1} className="input" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Expires (optional)</span>
          <input name="expiresAt" type="date" className="input" />
        </label>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Code created ✓</p>}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create code"}
      </button>
    </form>
  );
}

export function CouponActions({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => start(() => toggleCoupon(id))} disabled={pending} className="btn-ghost text-xs">
        {active ? "Deactivate" : "Activate"}
      </button>
      {confirming ? (
        <>
          <button
            onClick={() => start(() => deleteCoupon(id))}
            disabled={pending}
            className="rounded-md bg-danger px-2 py-1 text-xs font-semibold text-white"
          >
            Confirm
          </button>
          <button onClick={() => setConfirming(false)} className="text-xs text-muted">Keep</button>
        </>
      ) : (
        <button onClick={() => setConfirming(true)} className="btn-ghost text-xs text-danger">Delete</button>
      )}
    </div>
  );
}
