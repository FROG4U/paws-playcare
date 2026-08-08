"use client";

import { useActionState } from "react";
import { saveFieldSettings, type FormState } from "../actions";
import { penceToPounds } from "@/lib/money";
import type { FieldSetting } from "@prisma/client";

export function SettingsForm({ s, terms }: { s: FieldSetting; terms: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveFieldSettings, {});
  return (
    <form action={action} className="space-y-6">
      {/* Pricing & horizon */}
      <section className="card space-y-4">
        <h2 className="font-bold">Pricing & availability</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Price per 1-hour slot (£)">
            <input name="slotPricePounds" defaultValue={penceToPounds(s.slotPrice)} className="input" inputMode="decimal" />
          </Field>
          <Field label="Book up to (days ahead)">
            <input name="maxAdvanceDays" type="number" min={1} defaultValue={s.maxAdvanceDays} className="input" />
          </Field>
          <Field label="Season">
            <select name="seasonMode" defaultValue={s.seasonMode} className="input">
              <option value="AUTO">Auto (UK clocks)</option>
              <option value="ALWAYS_SUMMER">Always summer hours</option>
              <option value="ALWAYS_WINTER">Always winter hours</option>
            </select>
          </Field>
        </div>
        <p className="text-xs text-muted">
          Auto uses British Summer Time: summer hours from the last Sunday of March to the last
          Sunday of October, winter hours the rest of the year.
        </p>
      </section>

      {/* Opening hours */}
      <section className="card space-y-4">
        <h2 className="font-bold">Opening hours</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-brand-soft/40 p-3">
            <p className="mb-2 text-sm font-semibold">Summer (BST)</p>
            <div className="flex items-center gap-2">
              <HourInput name="summerOpenHour" value={s.summerOpenHour} />
              <span className="text-muted">to</span>
              <HourInput name="summerCloseHour" value={s.summerCloseHour} />
            </div>
          </div>
          <div className="rounded-xl bg-mist p-3">
            <p className="mb-2 text-sm font-semibold">Winter (GMT)</p>
            <div className="flex items-center gap-2">
              <HourInput name="winterOpenHour" value={s.winterOpenHour} />
              <span className="text-muted">to</span>
              <HourInput name="winterCloseHour" value={s.winterCloseHour} />
            </div>
          </div>
        </div>
        <p className="text-xs text-muted">Slots are one hour each; the last slot ends at the closing time.</p>
      </section>

      {/* Access codes + location (used in the confirmation email) */}
      <section className="card space-y-4">
        <h2 className="font-bold">Access codes & location</h2>
        <p className="-mt-2 text-xs text-muted">These appear in the confirmation email each customer receives after paying.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Main gate PIN">
            <input name="gatePin" defaultValue={s.gatePin} className="input" />
          </Field>
          <Field label="Playground padlock code">
            <input name="padlockCode" defaultValue={s.padlockCode} className="input" />
          </Field>
          <Field label="Postcode">
            <input name="postcode" defaultValue={s.postcode} className="input" />
          </Field>
          <Field label="Service name">
            <input name="serviceName" defaultValue={s.serviceName} className="input" />
          </Field>
        </div>
        <Field label="Directions note">
          <textarea name="locationNote" defaultValue={s.locationNote} rows={2} className="input" />
        </Field>
      </section>

      {/* Signed-by */}
      <section className="card space-y-4">
        <h2 className="font-bold">Email sign-off</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Provider name">
            <input name="providerName" defaultValue={s.providerName} className="input" />
          </Field>
          <Field label="Company name">
            <input name="companyName" defaultValue={s.companyName} className="input" />
          </Field>
          <Field label="Contact phone">
            <input name="contactPhone" defaultValue={s.contactPhone} className="input" />
          </Field>
        </div>
      </section>

      {/* Playground rules / T&Cs */}
      <section className="card space-y-3">
        <h2 className="font-bold">Playground rules &amp; T&amp;Cs</h2>
        <p className="-mt-1 text-xs text-muted">
          Shown at checkout — customers must tick to accept before booking. Acceptance is recorded on each booking.
        </p>
        <textarea name="playgroundTerms" defaultValue={terms} rows={8} className="input" />
      </section>

      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.ok && <p className="text-sm text-success">Saved ✓</p>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function HourInput({ name, value }: { name: string; value: number }) {
  return (
    <select name={name} defaultValue={value} className="input w-28">
      {Array.from({ length: 25 }).map((_, h) => (
        <option key={h} value={h}>
          {String(h).padStart(2, "0")}:00
        </option>
      ))}
    </select>
  );
}
