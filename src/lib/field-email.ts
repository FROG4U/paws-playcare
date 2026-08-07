// Field-booking confirmation email — sent automatically once a booking's card
// payment has cleared. Wording matches the copy Kitty supplied; the access
// codes, postcode, provider and company all come from Field Settings so they
// can be changed in one place without touching code.

import { sendEmail, emailShell } from "./email";
import { formatDate } from "./dates";
import { slotLabel } from "./field";
import type { FieldSetting } from "@prisma/client";

export type FieldConfirmationInput = {
  settings: FieldSetting;
  to: string;
  clientName: string;
  reference: string;
  date: Date;
  hours: number[]; // sorted slot start-hours
  total: number; // pence, for the receipt line
};

function timesSentence(hours: number[]): string {
  const sorted = [...hours].sort((a, b) => a - b);
  return sorted.map(slotLabel).join(", ");
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function fieldConfirmationHtml(input: FieldConfirmationInput): string {
  const s = input.settings;
  const first = [...input.hours].sort((a, b) => a - b)[0];
  const timeStart = `${String(first).padStart(2, "0")}:00`;
  const dateStart = formatDate(input.date);
  const p = (html: string) =>
    `<p style="margin:0 0 14px;line-height:1.55;">${html}</p>`;

  const body = `
    ${p(`Dear ${esc(input.clientName)},`)}
    ${p(
      `Thank you for booking an appointment with ${esc(s.companyName)}. May we take the opportunity to remind you that the Playground is used at your own discretion and you take full responsibility for the dog(s) in your care.`
    )}
    ${p(
      `You have booked <strong>${esc(s.serviceName)}</strong> with ${esc(
        s.providerName
      )} on <strong>${esc(dateStart)}</strong> at <strong>${timeStart}</strong>.`
    )}
    <div style="margin:0 0 16px;padding:12px 16px;background:#eaeef4;border-radius:12px;">
      <p style="margin:0 0 6px;font-weight:700;color:#333a41;">Your slot${
        input.hours.length > 1 ? "s" : ""
      }</p>
      <p style="margin:0;line-height:1.6;">${esc(timesSentence(input.hours))}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">Reference ${esc(
        input.reference
      )}</p>
    </div>
    ${p(
      `Please use the Postcode <strong>${esc(
        s.postcode
      )}</strong> but ${esc(s.locationNote)}`
    )}
    ${p(`Our playground is self service.<br/>To gain access please follow these instructions —`)}
    <div style="margin:0 0 14px;padding:12px 16px;border:1px solid #e2e8f0;border-radius:12px;line-height:1.6;">
      <p style="margin:0 0 8px;">Main black electric gates: Press PIN <strong>${esc(
        s.gatePin
      )}</strong> OK</p>
      <p style="margin:0 0 8px;">Drive straight ahead down the track until you reach the playground gate — the padlock code is: <strong>${esc(
        s.padlockCode
      )}</strong></p>
      <p style="margin:0 0 8px;">Please park INSIDE the playground — 2 vehicles max. and kindly we ask that you do not block the track for other users' access.</p>
      <p style="margin:0;">Please stay on the track and reverse back out, do not drive on the mud or you will get stuck!</p>
    </div>
    ${p(
      `Please report any damages you see and if there is excessive poo left behind as we want to monitor and keep things as nice and clean for everyone as we possibly can! Many thanks!`
    )}
    ${p(`We hope you have fun!`)}
    ${p(
      `Kind regards,<br/>${esc(s.providerName)}<br/>${esc(
        s.companyName
      )}<br/>${esc(s.contactPhone)}`
    )}
  `;
  return emailShell("Your playground booking is confirmed", body);
}

export async function sendFieldConfirmation(input: FieldConfirmationInput) {
  return sendEmail({
    to: input.to,
    subject: `Your ${input.settings.serviceName} booking — ${formatDate(
      input.date
    )}`,
    html: fieldConfirmationHtml(input),
  });
}
