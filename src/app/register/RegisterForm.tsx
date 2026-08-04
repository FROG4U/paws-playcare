"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerClient } from "@/app/actions/register";

// Slots offered at registration, derived from the admin's configured services
// (passed in from the server page). Each option's `value` is the readable label
// that gets stored on the account.
export type SlotGroup = {
  name: string;
  timeSlotLabel: string;
  options: { value: string; day: string }[];
};

type Dog = {
  name: string;
  breed: string;
  age: string;
  ageUnderOne: string;
  neutered: boolean;
  healthDetails: string;
  medicalConditions: boolean;
  medicalDetails: string;
  vaccinationsCurrent: boolean;
  kennelCoughCurrent: boolean;
  allergies: string;
  microchipped: boolean;
  insured: boolean;
  aggressionPeople: boolean;
  aggressionAnimals: boolean;
  fenceJumping: boolean;
  possessiveness: boolean;
  socialises: boolean;
  acceptsTreats: boolean;
  obedienceNotes: string;
  historyBiting: boolean;
  historyGrowling: boolean;
  escapeAttempts: boolean;
  reactedNegatively: boolean;
  negativeReactions: string;
  houseTrained: boolean;
  triggers: string;
  otherNotes: string;
};

function emptyDog(): Dog {
  return {
    name: "",
    breed: "",
    age: "",
    ageUnderOne: "",
    neutered: true,
    healthDetails: "",
    medicalConditions: false,
    medicalDetails: "",
    vaccinationsCurrent: true,
    kennelCoughCurrent: true,
    allergies: "",
    microchipped: true,
    insured: false,
    aggressionPeople: false,
    aggressionAnimals: false,
    fenceJumping: false,
    possessiveness: false,
    socialises: true,
    acceptsTreats: true,
    obedienceNotes: "",
    historyBiting: false,
    historyGrowling: false,
    escapeAttempts: false,
    reactedNegatively: false,
    negativeReactions: "",
    houseTrained: true,
    triggers: "",
    otherNotes: "",
  };
}

export function RegisterForm({ slotGroups }: { slotGroups: SlotGroup[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [account, setAccount] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    emergencyName: "",
    emergencyPhone: "",
    payCadence: "WEEKLY",
  });
  const [dogs, setDogs] = useState<Dog[]>([emptyDog()]);
  const [slots, setSlots] = useState<string[]>([]);
  const [startDate, setStartDate] = useState("");
  const [infoAccurate, setInfoAccurate] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  function toggleSlot(key: string) {
    setSlots((prev) =>
      prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]
    );
  }

  function setDog(i: number, patch: Partial<Dog>) {
    setDogs((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  function submit() {
    setError(null);
    if (!infoAccurate) {
      setError("Please confirm the information given is accurate.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please read and accept the terms & conditions.");
      return;
    }
    startTransition(async () => {
      const res = await registerClient({
        ...account,
        slots,
        startDate,
        infoAccurate,
        acceptedTerms,
        dogs,
      });
      if (res.ok) {
        router.push("/register/pending");
      } else {
        setError(res.error);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  const acc = (k: keyof typeof account) => account[k];

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {/* Contact information */}
      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Your details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            <input className="input" value={acc("name")} onChange={(e) => setAccount({ ...account, name: e.target.value })} />
          </Field>
          <Field label="Email" required>
            <input type="email" className="input" value={acc("email")} onChange={(e) => setAccount({ ...account, email: e.target.value })} />
          </Field>
          <Field label="Password" required hint="At least 8 characters">
            <input type="password" className="input" value={acc("password")} onChange={(e) => setAccount({ ...account, password: e.target.value })} />
          </Field>
          <Field label="Contact number">
            <input className="input" value={acc("phone")} onChange={(e) => setAccount({ ...account, phone: e.target.value })} />
          </Field>
          <Field label="Address" className="sm:col-span-2">
            <input className="input" value={acc("address")} onChange={(e) => setAccount({ ...account, address: e.target.value })} />
          </Field>
          <Field label="Emergency contact name" required>
            <input className="input" value={acc("emergencyName")} onChange={(e) => setAccount({ ...account, emergencyName: e.target.value })} />
          </Field>
          <Field label="Emergency contact number" required>
            <input className="input" value={acc("emergencyPhone")} onChange={(e) => setAccount({ ...account, emergencyPhone: e.target.value })} />
          </Field>
        </div>

        <Field label="How would you like to pay?" required>
          <div className="grid grid-cols-3 gap-2">
            {["DAILY", "WEEKLY", "MONTHLY"].map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setAccount({ ...account, payCadence: c })}
                className={`rounded-lg border px-3 py-2.5 text-sm font-semibold capitalize transition ${
                  account.payCadence === c
                    ? "border-brand bg-brand text-white"
                    : "border-border bg-surface hover:bg-brand-soft"
                }`}
              >
                {c.toLowerCase()}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">
            We collect payment automatically for completed walks on this schedule.
          </p>
        </Field>
      </section>

      {/* Booking requirements */}
      <section className="card space-y-4">
        <div>
          <h2 className="text-lg font-bold">Booking requirements</h2>
          <p className="text-sm text-muted">
            Which slots would you usually like? You can change or add one-off
            walks from your calendar once you&apos;re approved.
          </p>
        </div>
        {slotGroups.length === 0 ? (
          <p className="text-sm text-muted">
            No services are available to book right now — you can still register
            and an admin will set your walks up.
          </p>
        ) : (
          <div className="space-y-4">
            {slotGroups.map((g) => (
              <div key={g.name}>
                <p className="mb-2 text-sm font-semibold">
                  {g.name}{" "}
                  <span className="font-normal text-muted">· {g.timeSlotLabel}</span>
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {g.options.map((o) => (
                    <Check key={o.value} label={o.day} checked={slots.includes(o.value)} onChange={() => toggleSlot(o.value)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <Field label="Start date" required>
          <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
      </section>

      {/* Dogs */}
      {dogs.map((dog, i) => (
        <section key={i} className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{dog.name.trim() || `Dog ${dogs.length > 1 ? i + 1 : ""}`.trim()}</h2>
            {dogs.length > 1 && (
              <button type="button" className="text-sm font-semibold text-danger" onClick={() => setDogs((prev) => prev.filter((_, idx) => idx !== i))}>
                Remove
              </button>
            )}
          </div>

          <Field label="Dog's name" required>
            <input className="input" value={dog.name} onChange={(e) => setDog(i, { name: e.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Breed" required>
              <input className="input" value={dog.breed} onChange={(e) => setDog(i, { breed: e.target.value })} />
            </Field>
            <Field label="Age" required>
              <input className="input" value={dog.age} onChange={(e) => setDog(i, { age: e.target.value })} />
            </Field>
            <Field label="Age if less than 1 year">
              <input className="input" value={dog.ageUnderOne} onChange={(e) => setDog(i, { ageUnderOne: e.target.value })} />
            </Field>
            <YesNo label="Has this dog been neutered / spayed?" required value={dog.neutered} onChange={(v) => setDog(i, { neutered: v })} />
          </div>

          <Field label="Please give details of your dog's health, any medication (where applicable)" required>
            <textarea className="input min-h-20" value={dog.healthDetails} onChange={(e) => setDog(i, { healthDetails: e.target.value })} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <YesNo label="Medical conditions?" required value={dog.medicalConditions} onChange={(v) => setDog(i, { medicalConditions: v })} />
          </div>
          {dog.medicalConditions && (
            <Field label="If yes, please provide details, including any medication required">
              <textarea className="input min-h-20" value={dog.medicalDetails} onChange={(e) => setDog(i, { medicalDetails: e.target.value })} />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <YesNo label="Up to date with all vaccinations, worming and flea treatment?" required value={dog.vaccinationsCurrent} onChange={(v) => setDog(i, { vaccinationsCurrent: v })} />
            <YesNo label="Up to date with kennel cough?" required value={dog.kennelCoughCurrent} onChange={(v) => setDog(i, { kennelCoughCurrent: v })} />
          </div>
          <Field label="Do your dogs have any allergies / food sensitivities? If so please provide details">
            <textarea className="input min-h-16" value={dog.allergies} onChange={(e) => setDog(i, { allergies: e.target.value })} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <YesNo label="Microchipped?" required value={dog.microchipped} onChange={(v) => setDog(i, { microchipped: v })} />
            <YesNo label="Shown any aggressive tendencies towards people or children?" required value={dog.aggressionPeople} onChange={(v) => setDog(i, { aggressionPeople: v })} />
            <YesNo label="Aggressive towards other animals such as cats or chickens?" required value={dog.aggressionAnimals} onChange={(v) => setDog(i, { aggressionAnimals: v })} />
            <YesNo label="Do your dogs try to jump fences?" required value={dog.fenceJumping} onChange={(v) => setDog(i, { fenceJumping: v })} />
            <YesNo label="Possessive over toys, food or other objects?" required value={dog.possessiveness} onChange={(v) => setDog(i, { possessiveness: v })} />
            <YesNo label="Do your dogs socialise well with other dogs?" required value={dog.socialises} onChange={(v) => setDog(i, { socialises: v })} />
            <YesNo label="Are your dogs allowed treats?" required value={dog.acceptsTreats} onChange={(v) => setDog(i, { acceptsTreats: v })} />
          </div>

          <Field label="Describe your dog's level of obedience and familiar command words" required>
            <textarea className="input min-h-16" value={dog.obedienceNotes} onChange={(e) => setDog(i, { obedienceNotes: e.target.value })} />
          </Field>

          <p className="label">Has your dog(s) ever…</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <YesNo label="Bitten someone?" required value={dog.historyBiting} onChange={(v) => setDog(i, { historyBiting: v })} />
            <YesNo label="Growled at someone?" required value={dog.historyGrowling} onChange={(v) => setDog(i, { historyGrowling: v })} />
            <YesNo label="Escaped from your property?" required value={dog.escapeAttempts} onChange={(v) => setDog(i, { escapeAttempts: v })} />
            <YesNo label="Reacted negatively to any situation?" required value={dog.reactedNegatively} onChange={(v) => setDog(i, { reactedNegatively: v })} />
          </div>
          <Field label="If yes to any of the above – please provide details">
            <textarea className="input min-h-16" value={dog.negativeReactions} onChange={(e) => setDog(i, { negativeReactions: e.target.value })} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <YesNo label="Are your dogs fully house trained?" value={dog.houseTrained} onChange={(v) => setDog(i, { houseTrained: v })} />
            <YesNo label="Are your dogs insured?" required value={dog.insured} onChange={(v) => setDog(i, { insured: v })} />
          </div>
          <Field label="Does anything unsettle your dog? i.e. fireworks, thunder & lightning, cars, etc? Please provide information if so" required>
            <textarea className="input min-h-16" value={dog.triggers} onChange={(e) => setDog(i, { triggers: e.target.value })} />
          </Field>
          <Field label="Any other details you feel we should be made aware of" required>
            <textarea className="input min-h-16" value={dog.otherNotes} onChange={(e) => setDog(i, { otherNotes: e.target.value })} />
          </Field>
        </section>
      ))}

      {dogs.length < 5 && (
        <button type="button" className="btn-outline w-full" onClick={() => setDogs((prev) => [...prev, emptyDog()])}>
          + Add another dog
        </button>
      )}

      {/* Confirmation */}
      <div className="card space-y-3">
        <h2 className="text-lg font-bold">Confirmation</h2>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={infoAccurate} onChange={(e) => setInfoAccurate(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
          <span>I confirm that the information given is accurate to the best of my knowledge.</span>
        </label>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--brand)]" />
          <span>
            I have read and agree to Paws Playcare&apos;s{" "}
            <Link href="/terms" target="_blank" className="font-semibold text-brand underline">
              terms &amp; conditions
            </Link>
            .
          </span>
        </label>
        <p className="text-xs text-muted">
          Your details are stored securely and only shared where needed to care
          for your dog (e.g. with a vet in an emergency).
        </p>
      </div>

      <button type="button" onClick={submit} disabled={pending} className="btn-primary w-full py-3 text-base">
        {pending ? "Creating account…" : "Create account"}
      </button>
    </div>
  );
}

function Field({
  label,
  children,
  required,
  hint,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function YesNo({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  required?: boolean;
}) {
  return (
    <Field label={label} required={required}>
      <select
        className="input"
        value={value ? "yes" : "no"}
        onChange={(e) => onChange(e.target.value === "yes")}
      >
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </select>
    </Field>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--brand)]"
      />
      <span>{label}</span>
    </label>
  );
}
