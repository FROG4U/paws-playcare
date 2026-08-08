"use client";

import { useActionState } from "react";
import { updateFieldProfile, type ProfileState } from "./actions";

export function ProfileForm({
  name,
  email,
  phone,
  address,
  carReg,
}: {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  carReg: string | null;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateFieldProfile,
    {}
  );
  return (
    <form action={action} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Name</span>
        <input name="name" defaultValue={name} className="input" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Email</span>
        <input value={email} disabled className="input opacity-70" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Phone</span>
        <input name="phone" defaultValue={phone ?? ""} className="input" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Address</span>
        <input name="address" defaultValue={address ?? ""} className="input" placeholder="Your address" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Car registration</span>
        <input name="carReg" defaultValue={carReg ?? ""} className="input uppercase" maxLength={10} />
      </label>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p className="text-sm text-success">Saved.</p>}
      <button className="btn-outline" disabled={pending}>
        {pending ? "Saving…" : "Save details"}
      </button>
    </form>
  );
}
