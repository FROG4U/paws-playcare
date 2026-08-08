"use client";

import { useActionState } from "react";
import { createStaffAccount, type StaffFormState } from "./actions";

// Create a staff account (admin or walker) directly — name, email, password.
export function AddStaff() {
  const [state, action, pending] = useActionState<StaffFormState, FormData>(createStaffAccount, {});
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Name</span>
          <input name="name" className="input" placeholder="e.g. Kitty Cole" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input name="email" type="email" className="input" placeholder="kitty@pawsplaycare.co.uk" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Password (min 8)</span>
          <input name="password" type="text" className="input" placeholder="Set a password" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Role</span>
          <select name="role" defaultValue="ADMIN" className="input">
            <option value="ADMIN">Admin (full access)</option>
            <option value="WORKER">Walker</option>
          </select>
        </label>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && (
        <p className="text-sm font-medium text-success">
          {state.createdName} added — they can log in at /PPC now.
        </p>
      )}
      <button className="btn-primary" disabled={pending}>
        {pending ? "Adding…" : "Add team member"}
      </button>
      <p className="text-xs text-muted">
        Creates the account instantly with the password you set — no invite link or email needed.
      </p>
    </form>
  );
}
