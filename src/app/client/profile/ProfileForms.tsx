"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { DogFields, type DogDefaults } from "@/components/DogFields";
import { saveMyProfile, addMyDog, saveMyDog, archiveMyDog, unarchiveMyDog } from "./actions";

export function ProfileForm({
  profile,
}: {
  profile: { name: string; email: string; phone: string | null; address: string | null; emergencyName: string | null; emergencyPhone: string | null };
}) {
  const [state, action, pending] = useActionState(saveMyProfile, null);
  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-bold">Your details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Full name</span>
          <input name="name" defaultValue={profile.name} required className="input" />
        </label>
        <label className="block">
          <span className="label">Email (your login)</span>
          <input name="email" type="email" defaultValue={profile.email} required className="input" />
        </label>
        <label className="block">
          <span className="label">Phone</span>
          <input name="phone" defaultValue={profile.phone ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Address</span>
          <input name="address" defaultValue={profile.address ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Emergency contact name</span>
          <input name="emergencyName" defaultValue={profile.emergencyName ?? ""} className="input" />
        </label>
        <label className="block">
          <span className="label">Emergency contact phone</span>
          <input name="emergencyPhone" defaultValue={profile.emergencyPhone ?? ""} className="input" />
        </label>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : "Save details"}</button>
        {state?.ok && <span className="text-sm text-success">Saved ✓</span>}
        {state && !state.ok && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

export function EditMyDogForm({ dog }: { dog: DogDefaults & { id: string } }) {
  const [state, action, pending] = useActionState(saveMyDog, null);
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <details className="card">
      <summary className="cursor-pointer text-lg font-bold">🐕 {dog.name}</summary>
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="dogId" value={dog.id} />
        <DogFields dog={dog} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pending} className="btn-primary">{pending ? "Saving…" : `Save ${dog.name}`}</button>
          <button
            type="button"
            disabled={busy}
            className="btn-ghost text-danger"
            onClick={() => {
              if (!window.confirm(`Archive ${dog.name}? They'll be hidden and can't be booked, but you can restore them later.`)) return;
              start(async () => { await archiveMyDog(dog.id); router.refresh(); });
            }}
          >
            <Icon name="inbox" className="h-4 w-4" /> Archive
          </button>
          {state?.ok && <span className="text-sm text-success">Saved ✓</span>}
          {state && !state.ok && <span className="text-sm text-danger">{state.error}</span>}
        </div>
      </form>
    </details>
  );
}

export function AddDogForm() {
  const [state, action, pending] = useActionState(addMyDog, null);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="btn-outline" onClick={() => setOpen(true)}>
        <Icon name="plus" className="h-4 w-4" /> Add a dog
      </button>
    );
  }
  return (
    <form action={action} className="card space-y-4">
      <h2 className="text-lg font-bold">Add a dog</h2>
      <DogFields />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? "Adding…" : "Add dog"}</button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        {state && !state.ok && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}

export function UnarchiveDog({ dogId, name }: { dogId: string; name: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <button
      disabled={busy}
      className="text-sm font-semibold text-brand hover:underline"
      onClick={() => start(async () => { await unarchiveMyDog(dogId); router.refresh(); })}
    >
      Restore {name}
    </button>
  );
}
