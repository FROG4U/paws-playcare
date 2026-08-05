import PDFDocument from "pdfkit";
import { formatDate } from "./dates";
import { formatMoney } from "./money";
import { periodLabel } from "./billing";
import { INVOICE_STATUS } from "./constants";

type Doc = {
  invoice: {
    number: string;
    cadence: string;
    status: string;
    periodStart: Date;
    periodEnd: Date;
    total: number;
    dueAt: Date | null;
    paidAt: Date | null;
    createdAt: Date;
    items: { description: string; amount: number }[];
  };
  client: { name: string; email: string | null; phone: string | null; address: string | null };
  business: { siteName: string; contactEmail: string; contactPhone: string; address: string };
};

const BRAND = "#2ea6d8";
const INK = "#1f2937";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

function statusLabel(inv: Doc["invoice"]): string {
  if (inv.status === INVOICE_STATUS.PAID) return "PAID";
  if (inv.status === INVOICE_STATUS.OPEN) return inv.dueAt ? "DUE" : "DRAFT";
  return inv.status;
}

// Build a branded A4 invoice PDF as a Buffer.
export function invoicePdfBuffer(data: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { invoice, client, business } = data;
    const left = 50;
    const right = doc.page.width - 50;
    const colW = right - left;

    // ── Header ──────────────────────────────────────────────────────────────
    doc.font("Helvetica-Bold").fontSize(20).fillColor(BRAND).text(business.siteName, left, 50);
    doc.font("Helvetica-Bold").fontSize(20).fillColor(INK).text("INVOICE", left, 50, { width: colW, align: "right" });
    doc.font("Helvetica").fontSize(10).fillColor(MUTED);
    doc.text(`No. ${invoice.number}`, left, 76, { width: colW, align: "right" });
    doc.text(`Issued ${formatDate(invoice.createdAt)}`, left, 90, { width: colW, align: "right" });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(BRAND).text(statusLabel(invoice), left, 104, { width: colW, align: "right" });

    doc.moveTo(left, 122).lineTo(right, 122).strokeColor(LINE).lineWidth(1).stroke();

    // ── From / Bill to ──────────────────────────────────────────────────────
    let y = 138;
    const halfW = colW / 2 - 10;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("FROM", left, y);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(business.siteName, left, y + 12, { width: halfW });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    [business.address, business.contactEmail, business.contactPhone].filter(Boolean).forEach((t) => doc.text(t!, { width: halfW }));

    const rx = left + colW / 2 + 10;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED).text("BILL TO", rx, y, { width: halfW });
    doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(client.name, rx, y + 12, { width: halfW });
    doc.font("Helvetica").fontSize(9).fillColor(MUTED);
    [client.address, client.email, client.phone].filter(Boolean).forEach((t) => doc.text(t!, rx, doc.y, { width: halfW }));

    // ── Period ──────────────────────────────────────────────────────────────
    y = 210;
    doc.roundedRect(left, y, colW, 26, 5).fill("#e2f1fb");
    doc.font("Helvetica").fontSize(10).fillColor("#1c6f95")
      .text(`Walks for ${periodLabel(invoice.cadence, { start: invoice.periodStart, end: invoice.periodEnd })}`, left + 10, y + 8, { width: colW - 20 });

    // ── Line items ──────────────────────────────────────────────────────────
    y += 44;
    const amtColW = 90;
    const descW = colW - amtColW - 10;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED);
    doc.text("DESCRIPTION", left, y, { width: descW });
    doc.text("AMOUNT", right - amtColW, y, { width: amtColW, align: "right" });
    y += 14;
    doc.moveTo(left, y).lineTo(right, y).strokeColor(LINE).stroke();
    y += 8;

    doc.font("Helvetica").fontSize(10).fillColor(INK);
    for (const it of invoice.items) {
      const h = doc.heightOfString(it.description, { width: descW });
      doc.text(it.description, left, y, { width: descW });
      doc.text(formatMoney(it.amount), right - amtColW, y, { width: amtColW, align: "right" });
      y += Math.max(h, 14) + 8;
      doc.moveTo(left, y - 4).lineTo(right, y - 4).strokeColor(LINE).stroke();
    }

    // ── Total ───────────────────────────────────────────────────────────────
    y += 6;
    doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text("Total", left, y, { width: descW, align: "right" });
    doc.font("Helvetica-Bold").fontSize(14).fillColor(BRAND).text(formatMoney(invoice.total), right - amtColW, y - 2, { width: amtColW, align: "right" });

    // ── Payment note ────────────────────────────────────────────────────────
    y += 30;
    const note =
      invoice.status === INVOICE_STATUS.PAID
        ? `Paid${invoice.paidAt ? ` on ${formatDate(invoice.paidAt)}` : ""} — thank you.`
        : invoice.dueAt
          ? `Payment of ${formatMoney(invoice.total)} will be taken automatically from your card on file on ${formatDate(invoice.dueAt)}.`
          : "This invoice is still adding up as walks are completed.";
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(note, left, y, { width: colW });

    // ── Footer ──────────────────────────────────────────────────────────────
    const footY = doc.page.height - 70;
    doc.moveTo(left, footY).lineTo(right, footY).strokeColor(LINE).stroke();
    const footer = [business.siteName, business.contactEmail, business.contactPhone].filter(Boolean).join("  ·  ");
    doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`Thank you for choosing ${business.siteName}!`, left, footY + 10, { width: colW, align: "center" });
    doc.text(footer, left, footY + 24, { width: colW, align: "center" });

    doc.end();
  });
}
