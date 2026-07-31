import { prisma } from "./prisma";
import { getSettings } from "./pricing";

// Auto-scoop UK bank holidays from the official gov.uk feed.
// Divisions: "england-and-wales" | "scotland" | "northern-ireland".
const FEED = "https://www.gov.uk/bank-holidays.json";

type GovFeed = Record<
  string,
  { division: string; events: { title: string; date: string }[] }
>;

export async function syncBankHolidays(): Promise<{
  division: string;
  added: number;
  total: number;
}> {
  const settings = await getSettings();
  const division = settings.bankHolidayDivision || "england-and-wales";

  const res = await fetch(FEED, { cache: "no-store" });
  if (!res.ok) throw new Error(`Bank holiday feed failed: ${res.status}`);
  const data = (await res.json()) as GovFeed;

  const section = data[division];
  if (!section) throw new Error(`Unknown division: ${division}`);

  let added = 0;
  for (const ev of section.events) {
    const date = new Date(ev.date + "T00:00:00.000Z");
    const existing = await prisma.bankHoliday.findUnique({ where: { date } });
    if (existing) {
      if (existing.title !== ev.title || existing.division !== division) {
        await prisma.bankHoliday.update({
          where: { date },
          data: { title: ev.title, division },
        });
      }
      continue;
    }
    await prisma.bankHoliday.create({
      data: { date, title: ev.title, division },
    });
    added++;
  }

  const total = await prisma.bankHoliday.count({ where: { division } });
  return { division, added, total };
}
