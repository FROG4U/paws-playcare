// Shared dog form fields — used by the client add/edit-dog forms. `dog` supplies
// defaults when editing; omit it for a blank "add a dog" form. Field `name`
// attributes match the parser in the client profile actions.

export type DogDefaults = {
  name?: string;
  breed?: string | null;
  age?: string | null;
  ageUnderOne?: string | null;
  neutered?: boolean;
  healthDetails?: string | null;
  medicalConditions?: boolean;
  medicalDetails?: string | null;
  vaccinationsCurrent?: boolean;
  kennelCoughCurrent?: boolean;
  allergies?: string | null;
  microchipped?: boolean;
  insured?: boolean;
  aggressionPeople?: boolean;
  aggressionAnimals?: boolean;
  fenceJumping?: boolean;
  possessiveness?: boolean;
  socialises?: boolean;
  acceptsTreats?: boolean;
  obedienceNotes?: string | null;
  historyBiting?: boolean;
  historyGrowling?: boolean;
  escapeAttempts?: boolean;
  reactedNegatively?: boolean;
  negativeReactions?: string | null;
  houseTrained?: boolean;
  triggers?: string | null;
  otherNotes?: string | null;
};

function Text({ name, label, defaultValue, full }: { name: string; label: string; defaultValue?: string | null; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-2" : ""}`}>
      <span className="label">{label}</span>
      <input name={name} defaultValue={defaultValue ?? ""} className="input" />
    </label>
  );
}
function Area({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
  return (
    <label className="block sm:col-span-2">
      <span className="label">{label}</span>
      <textarea name={name} defaultValue={defaultValue ?? ""} rows={2} className="input" />
    </label>
  );
}
function Check({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/10">
      <input type="checkbox" name={name} defaultChecked={!!defaultChecked} />
      {label}
    </label>
  );
}

export function DogFields({ dog }: { dog?: DogDefaults }) {
  const d = dog ?? {};
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Text name="name" label="Dog's name" defaultValue={d.name} />
        <Text name="breed" label="Breed" defaultValue={d.breed} />
        <Text name="age" label="Age" defaultValue={d.age} />
        <Text name="ageUnderOne" label="Age if under 1 year" defaultValue={d.ageUnderOne} />
      </div>

      <p className="text-sm font-bold text-brand-dark">General</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Check name="neutered" label="Neutered / spayed" defaultChecked={d.neutered} />
        <Check name="microchipped" label="Microchipped" defaultChecked={d.microchipped} />
        <Check name="insured" label="Insured" defaultChecked={d.insured} />
        <Check name="vaccinationsCurrent" label="Vaccinations up to date" defaultChecked={d.vaccinationsCurrent} />
        <Check name="kennelCoughCurrent" label="Kennel cough up to date" defaultChecked={d.kennelCoughCurrent} />
        <Check name="houseTrained" label="House trained" defaultChecked={d.houseTrained} />
      </div>

      <p className="text-sm font-bold text-brand-dark">Health &amp; medical</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Area name="healthDetails" label="Health details / medication" defaultValue={d.healthDetails} />
        <Check name="medicalConditions" label="Has medical conditions" defaultChecked={d.medicalConditions} />
        <Text name="medicalDetails" label="Medical details" defaultValue={d.medicalDetails} />
        <Text name="allergies" label="Allergies" defaultValue={d.allergies} full />
      </div>

      <p className="text-sm font-bold text-brand-dark">Behaviour &amp; temperament</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Check name="socialises" label="Socialises with other dogs" defaultChecked={d.socialises} />
        <Check name="acceptsTreats" label="Accepts treats" defaultChecked={d.acceptsTreats} />
        <Check name="aggressionPeople" label="Aggression to people" defaultChecked={d.aggressionPeople} />
        <Check name="aggressionAnimals" label="Aggression to animals" defaultChecked={d.aggressionAnimals} />
        <Check name="historyBiting" label="History of biting" defaultChecked={d.historyBiting} />
        <Check name="historyGrowling" label="History of growling" defaultChecked={d.historyGrowling} />
        <Check name="fenceJumping" label="Fence jumping" defaultChecked={d.fenceJumping} />
        <Check name="escapeAttempts" label="Escape attempts" defaultChecked={d.escapeAttempts} />
        <Check name="possessiveness" label="Possessiveness" defaultChecked={d.possessiveness} />
        <Check name="reactedNegatively" label="Reacted negatively before" defaultChecked={d.reactedNegatively} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Text name="obedienceNotes" label="Obedience notes" defaultValue={d.obedienceNotes} />
        <Text name="triggers" label="Triggers" defaultValue={d.triggers} />
        <Area name="negativeReactions" label="Negative-reaction details" defaultValue={d.negativeReactions} />
        <Area name="otherNotes" label="Other notes" defaultValue={d.otherNotes} />
      </div>
    </>
  );
}
