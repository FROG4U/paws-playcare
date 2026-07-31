import { getServices, serviceDays } from "@/lib/services";
import { formatMoney } from "@/lib/money";
import { Icon } from "@/components/Icon";

const DAY: Record<number, string> = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri" };
const SLOT: Record<string, string> = { AM: "Mornings", LUNCH: "Lunch time", PM: "Afternoons" };

// Prices come straight from the admin Services settings — edit them there.
export async function PricesTable() {
  const services = (await getServices()).filter((s) => s.active);
  if (services.length === 0) {
    return <p className="text-muted">Pricing is being updated — please check back soon.</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {services.map((s) => (
        <div key={s.id} className="card">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand">
              <Icon name="paw" className="h-[1.3rem] w-[1.3rem]" />
            </span>
            <div>
              <p className="font-bold">{s.name}</p>
              <p className="text-sm text-muted">
                {serviceDays(s).map((d) => DAY[d]).join(" · ")} · {SLOT[s.timeSlot] ?? s.timeSlot}
              </p>
            </div>
          </div>
          <p className="mt-3 text-2xl font-extrabold">
            {formatMoney(s.pricePerDog)} <span className="text-sm font-medium text-muted">per dog</span>
          </p>
        </div>
      ))}
    </div>
  );
}
