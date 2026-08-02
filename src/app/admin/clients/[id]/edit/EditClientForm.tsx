"use client";

import { useActionState } from "react";
import { saveClient } from "../actions";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  payCadence: string;
  notes: string | null;
};

export function EditClientForm({ client }: { client: Client }) {
  const [state, action, pending] = useActionState(saveClient, null);

  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-bold">Client details</h2>
      <input type="hidden" name="id" value={client.id} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Full name</span>
          <input name="name" defaultValue={client.name} required className="input" />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" defaultValue={client.email} required className="input" />
        </label>
        <label className="block">
          <span className="label">Phone</span>
          <input name="phone" defaultValue={client.phone ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Billing cadence</span>
          <select name="payCadence" defaultValue={client.payCadence} className="input">
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="MONTHLY">Monthly</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Address</span>
          <input name="address" defaultValue={client.address ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Emergency contact name</span>
          <input name="emergencyName" defaultValue={client.emergencyName ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Emergency contact phone</span>
          <input name="emergencyPhone" defaultValue={client.emergencyPhone ?? ""} className="input" />
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Notes</span>
          <textarea name="notes" defaultValue={client.notes ?? ""} rows={3} className="input" />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save client details"}
        </button>
        {state?.ok && <span className="text-sm text-success">Saved ✓</span>}
        {state && !state.ok && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
