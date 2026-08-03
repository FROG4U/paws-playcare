"use client";

import { Icon } from "./Icon";

// "Download" = open the print dialog → the browser's "Save as PDF" gives a
// clean, branded PDF of the invoice (print CSS hides the app chrome).
export function PrintButton({ label = "Download / Print" }: { label?: string }) {
  return (
    <button onClick={() => window.print()} className="btn-outline no-print">
      <Icon name="file" className="h-4 w-4" />
      {label}
    </button>
  );
}
