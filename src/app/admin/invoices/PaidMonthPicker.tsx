"use client";

import { useRouter, useSearchParams } from "next/navigation";

// Month dropdown for the paid-invoice archive. Each option is a "YYYY-MM" key
// with a friendly label; changing it sets ?m=… so the server re-renders just
// that month's paid invoices instead of one endless list.
export function PaidMonthPicker({
  months,
  selected,
}: {
  months: { key: string; label: string; count: number }[];
  selected: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <select
      value={selected}
      onChange={(e) => {
        const next = new URLSearchParams(params.toString());
        next.set("m", e.target.value);
        router.push(`/admin/invoices?${next.toString()}#paid`);
      }}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-semibold"
      aria-label="Filter paid invoices by month"
    >
      {months.map((m) => (
        <option key={m.key} value={m.key}>
          {m.label} ({m.count})
        </option>
      ))}
    </select>
  );
}
