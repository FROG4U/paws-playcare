import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/pricing";
import { penceToPounds, formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import {
  savePricing,
  addHolidayRate,
  deleteHolidayRate,
  syncHolidaysNow,
} from "./actions";

export default async function PricingPage() {
  const settings = await getSettings();
  const holidayRates = await prisma.holidayRate.findMany({
    orderBy: { startDate: "asc" },
  });
  const today = new Date();
  const upcoming = await prisma.bankHoliday.findMany({
    where: { date: { gte: today } },
    orderBy: { date: "asc" },
    take: 8,
  });
  const totalBH = await prisma.bankHoliday.count();

  return (
    <div className="space-y-6">
      <PageHeader icon="tag" title="Pricing" subtitle="Walk rates, holiday rates and rules." />

      {/* Standard pricing */}
      <form action={savePricing} className="card space-y-4">
        <h2 className="text-lg font-bold">Dog walk prices</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Money name="baseWalkPrice" label="Base walk price" value={settings.baseWalkPrice} />
          <Money name="extraDogFee" label="Each additional dog" value={settings.extraDogFee} />
          <Money name="bankHolidayWalkPrice" label="Bank holiday walk price" value={settings.bankHolidayWalkPrice} />
          <Money name="bankHolidayExtraDogFee" label="Bank holiday — extra dog" value={settings.bankHolidayExtraDogFee} />
          <Money name="workerFlatRate" label="Worker pay per walk" value={settings.workerFlatRate} />
        </div>

        <h2 className="pt-2 text-lg font-bold">Rules</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Unpaid grace (days)</label>
            <input name="unpaidGraceDays" type="number" min={1} defaultValue={settings.unpaidGraceDays} className="input" />
            <p className="mt-1 text-xs text-muted">Block client after this many unpaid days.</p>
          </div>
          <div>
            <label className="label">Card expiry warning (days)</label>
            <input name="cardExpiryWarnDays" type="number" min={1} defaultValue={settings.cardExpiryWarnDays} className="input" />
          </div>
          <div>
            <label className="label">Bank holiday region</label>
            <select name="bankHolidayDivision" defaultValue={settings.bankHolidayDivision} className="input">
              <option value="england-and-wales">England &amp; Wales</option>
              <option value="scotland">Scotland</option>
              <option value="northern-ireland">Northern Ireland</option>
            </select>
          </div>
        </div>
        <button className="btn-primary">Save pricing</button>
      </form>

      {/* Custom holiday rates */}
      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-bold">Holiday rates</h2>
          <p className="text-sm text-muted">
            Special pricing for date ranges (e.g. Christmas week). These override
            bank-holiday and base rates.
          </p>
        </div>

        {holidayRates.length > 0 && (
          <ul className="divide-y divide-border">
            {holidayRates.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <p className="font-semibold">
                    {h.name}{" "}
                    {!h.active && (
                      <span className="badge bg-border text-muted">off</span>
                    )}
                  </p>
                  <p className="text-sm text-muted">
                    {formatDate(h.startDate)} → {formatDate(h.endDate)} ·{" "}
                    {formatMoney(h.walkPrice)} walk (+{formatMoney(h.extraDogFee)}/dog)
                  </p>
                </div>
                <form action={deleteHolidayRate.bind(null, h.id)}>
                  <button className="text-sm font-semibold text-danger">Delete</button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addHolidayRate} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Name</label>
            <input name="name" required className="input" placeholder="Christmas week" />
          </div>
          <div>
            <label className="label">Start date</label>
            <input name="startDate" type="date" required className="input" />
          </div>
          <div>
            <label className="label">End date</label>
            <input name="endDate" type="date" required className="input" />
          </div>
          <Money name="walkPrice" label="Walk price" value={settings.bankHolidayWalkPrice} />
          <Money name="extraDogFee" label="Extra dog fee" value={settings.bankHolidayExtraDogFee} />
          <div className="sm:col-span-2">
            <button className="btn-accent">Add holiday rate</button>
          </div>
        </form>
      </div>

      {/* Bank holidays */}
      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold">UK bank holidays</h2>
            <p className="text-sm text-muted">
              {totalBH} stored · auto-scooped from gov.uk for{" "}
              {settings.bankHolidayDivision.replace(/-/g, " ")}.
            </p>
          </div>
          <form action={syncHolidaysNow}>
            <button className="btn-outline">Sync now</button>
          </form>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-muted">
            None stored yet — click “Sync now” to import them.
          </p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {upcoming.map((b) => (
              <li key={b.id} className="flex justify-between rounded-lg bg-background/50 px-3 py-2 text-sm">
                <span className="font-semibold">{b.title}</span>
                <span className="text-muted">{formatDate(b.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Money({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
          £
        </span>
        <input
          name={name}
          defaultValue={penceToPounds(value)}
          inputMode="decimal"
          className="input pl-7"
        />
      </div>
    </div>
  );
}
