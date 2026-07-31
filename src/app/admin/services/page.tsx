import { getServices, serviceDays } from "@/lib/services";
import { penceToPounds } from "@/lib/money";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { addService, updateService, toggleService, deleteService } from "./actions";

const WEEKDAYS = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
];

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <div className="space-y-6">
      <PageHeader
        icon="paw"
        title="Services"
        subtitle="What clients can book, priced per dog, and the days each runs."
      />

      {/* How availability works */}
      <div className="card space-y-1.5 border-l-4 border-l-accent">
        <h2 className="font-bold">Availability rules</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Clients can only book a service on the weekdays you tick below.</li>
          <li><strong>Saturdays, Sundays and UK bank holidays are always closed</strong> — they can never be booked.</li>
          <li>
            If a repeating booking lands on a bank holiday, that date is
            automatically skipped and the client is notified.
          </li>
        </ul>
        <p className="pt-1 text-xs text-muted">
          Bank holidays are managed on the <strong>Pricing</strong> page (“Sync now”).
        </p>
      </div>

      {/* Existing services */}
      <div className="space-y-4">
        {services.map((s) => {
          const days = serviceDays(s);
          return (
            <div key={s.id} className="card space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold">
                  {s.name}{" "}
                  {!s.active && <span className="badge bg-border text-muted">off</span>}
                </h2>
                <div className="flex items-center gap-3">
                  <form action={toggleService.bind(null, s.id, !s.active)}>
                    <button className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
                      <Icon name={s.active ? "pause" : "play"} className="h-4 w-4" />
                      {s.active ? "Turn off" : "Turn on"}
                    </button>
                  </form>
                  <form action={deleteService.bind(null, s.id)}>
                    <button className="inline-flex items-center gap-1 text-sm font-semibold text-danger">
                      <Icon name="trash" className="h-4 w-4" />
                      Delete
                    </button>
                  </form>
                </div>
              </div>

              <form action={updateService.bind(null, s.id)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Service name</label>
                    <input name="name" required defaultValue={s.name} className="input" />
                  </div>
                  <Money name="pricePerDog" label="Price per dog" value={s.pricePerDog} />
                </div>

                <div>
                  <label className="label">Available days</label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS.map((d) => (
                      <label
                        key={d.n}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/10"
                      >
                        <input type="checkbox" name="days" value={d.n} defaultChecked={days.includes(d.n)} />
                        {d.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">Time</label>
                    <select name="timeSlot" defaultValue={s.timeSlot} className="input">
                      <option value="AM">Morning (AM)</option>
                      <option value="LUNCH">Lunch time</option>
                      <option value="PM">Afternoon (PM)</option>
                    </select>
                  </div>
                </div>

                <button className="btn-primary">Save changes</button>
              </form>
            </div>
          );
        })}
      </div>

      {/* Add a service */}
      <form action={addService} className="card space-y-4">
        <h2 className="text-lg font-bold">Add a service</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Service name</label>
            <input name="name" required className="input" placeholder="e.g. Field Play" />
          </div>
          <Money name="pricePerDog" label="Price per dog" value={1600} />
        </div>
        <div>
          <label className="label">Available days</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <label
                key={d.n}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:bg-brand/10"
              >
                <input type="checkbox" name="days" value={d.n} />
                {d.label}
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Time</label>
            <select name="timeSlot" defaultValue="AM" className="input">
              <option value="AM">Morning (AM)</option>
              <option value="LUNCH">Lunch time</option>
              <option value="PM">Afternoon (PM)</option>
            </select>
          </div>
        </div>
        <button className="btn-accent">Add service</button>
      </form>
    </div>
  );
}

function Money({ name, label, value }: { name: string; label: string; value: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">£</span>
        <input name={name} defaultValue={penceToPounds(value)} inputMode="decimal" className="input pl-7" />
      </div>
    </div>
  );
}
