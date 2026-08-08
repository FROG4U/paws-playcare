import { getFieldSettings, effectiveTerms } from "@/lib/field";
import { SettingsForm } from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function FieldSettingsPage() {
  const s = await getFieldSettings();
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Field settings</h1>
        <p className="text-muted">Everything for the playground-hire product in one place.</p>
      </div>
      <SettingsForm s={s} terms={effectiveTerms(s)} />
    </div>
  );
}
