// All money stored as integer pence. Helpers for formatting/parsing.

export function formatMoney(pence: number, currency = "gbp"): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((pence ?? 0) / 100);
}

// "15", "15.5", "£15.50" -> pence
export function poundsToPence(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const cleaned = input.replace(/[^0-9.]/g, "");
  if (!cleaned) return 0;
  return Math.round(parseFloat(cleaned) * 100);
}

export function penceToPounds(pence: number): string {
  return ((pence ?? 0) / 100).toFixed(2);
}
