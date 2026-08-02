"use client";

import { useActionState } from "react";
import { saveDog } from "../actions";

export type DogData = {
  id: string;
  name: string;
  breed: string | null;
  age: string | null;
  ageUnderOne: string | null;
  neutered: boolean;
  healthDetails: string | null;
  medicalConditions: boolean;
  medicalDetails: string | null;
  vaccinationsCurrent: boolean;
  kennelCoughCurrent: boolean;
  allergies: string | null;
  microchipped: boolean;
  insured: boolean;
  aggressionPeople: boolean;
  aggressionAnimals: boolean;
  fenceJumping: boolean;
  possessiveness: boolean;
  socialises: boolean;
  acceptsTreats: boolean;
  obedienceNotes: string | null;
  historyBiting: boolean;
  historyGrowling: boolean;
  escapeAttempts: boolean;
  reactedNegatively: boolean;
  negativeReactions: string | null;
  houseTrained: boolean;
  triggers: string | null;
  otherNotes: string | null;
};

function Text({ name, label, defaultValue, full }: { name: string; label: string; defaultValue: string | null; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="label">{label}</span>
      <input name={name} defaultValue={defaultValue ?? ""} className="input" />
    </label>
  );
}

function Area({ name, label, defaultValue }: { name: string; label: string; defaultValue: string | null }) {
  return (
    <label className="block sm:col-span-2">
      <span className="label">{label}</span>
      <textarea name={name} defaultValue={defaultValue ?? ""} rows={2} className="input" />
    </label>
  );
}

function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/10">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} />
      {label}
    </label>
  );
}

export function EditDogForm({ dog, clientId }: { dog: DogData; clientId: string }) {
  const [state, action, pending] = useActionState(saveDog, null);

  return (
    <form action={action} className="card space-y-4">
      <input type="hidden" name="dogId" value={dog.id} />
      <input type="hidden" name="clientId" value={clientId} />
      <h2 className="flex items-center gap-2 text-lg font-bold">🐕 {dog.name}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <Text name="name" label="Dog's name" defaultValue={dog.name} />
        <Text name="breed" label="Breed" defaultValue={dog.breed} />
        <Text name="age" label="Age" defaultValue={dog.age} />
        <Text name="ageUnderOne" label="Age if under 1 year" defaultValue={dog.ageUnderOne} />
      </div>

      <p className="text-sm font-bold text-brand-dark">General</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Check name="neutered" label="Neutered / spayed" defaultChecked={dog.neutered} />
        <Check name="microchipped" label="Microchipped" defaultChecked={dog.microchipped} />
        <Check name="insured" label="Insured" defaultChecked={dog.insured} />
        <Check name="vaccinationsCurrent" label="Vaccinations up to date" defaultChecked={dog.vaccinationsCurrent} />
        <Check name="kennelCoughCurrent" label="Kennel cough up to date" defaultChecked={dog.kennelCoughCurrent} />
        <Check name="houseTrained" label="House trained" defaultChecked={dog.houseTrained} />
      </div>

      <p className="text-sm font-bold text-brand-dark">Health & medical</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Area name="healthDetails" label="Health details / medication" defaultValue={dog.healthDetails} />
        <Check name="medicalConditions" label="Has medical conditions" defaultChecked={dog.medicalConditions} />
        <Text name="medicalDetails" label="Medical details" defaultValue={dog.medicalDetails} />
        <Text name="allergies" label="Allergies" defaultValue={dog.allergies} full />
      </div>

      <p className="text-sm font-bold text-brand-dark">Behaviour & temperament</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Check name="socialises" label="Socialises with other dogs" defaultChecked={dog.socialises} />
        <Check name="acceptsTreats" label="Accepts treats" defaultChecked={dog.acceptsTreats} />
        <Check name="aggressionPeople" label="Aggression to people" defaultChecked={dog.aggressionPeople} />
        <Check name="aggressionAnimals" label="Aggression to animals" defaultChecked={dog.aggressionAnimals} />
        <Check name="historyBiting" label="History of biting" defaultChecked={dog.historyBiting} />
        <Check name="historyGrowling" label="History of growling" defaultChecked={dog.historyGrowling} />
        <Check name="fenceJumping" label="Fence jumping" defaultChecked={dog.fenceJumping} />
        <Check name="escapeAttempts" label="Escape attempts" defaultChecked={dog.escapeAttempts} />
        <Check name="possessiveness" label="Possessiveness" defaultChecked={dog.possessiveness} />
        <Check name="reactedNegatively" label="Reacted negatively before" defaultChecked={dog.reactedNegatively} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Text name="obedienceNotes" label="Obedience notes" defaultValue={dog.obedienceNotes} />
        <Text name="triggers" label="Triggers" defaultValue={dog.triggers} />
        <Area name="negativeReactions" label="Negative-reaction details" defaultValue={dog.negativeReactions} />
        <Area name="otherNotes" label="Other notes" defaultValue={dog.otherNotes} />
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : `Save ${dog.name}`}
        </button>
        {state?.ok && <span className="text-sm text-success">Saved ✓</span>}
        {state && !state.ok && <span className="text-sm text-danger">{state.error}</span>}
      </div>
    </form>
  );
}
