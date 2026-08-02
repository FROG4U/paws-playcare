// Transactional email via Resend. Works without a key configured — it just
// logs and no-ops, so the whole billing flow runs in dev/local before email is
// live. Set RESEND_API_KEY (and optionally EMAIL_FROM) in .env to send for real.

import { Resend } from "resend";

let _resend: Resend | null = null;

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

function fromAddress(): string {
  return process.env.EMAIL_FROM || "Paws Playcare <onboarding@resend.dev>";
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!emailConfigured()) {
    console.log(`[email skipped — no RESEND_API_KEY] to=${opts.to} subject="${opts.subject}"`);
    return { ok: true, skipped: true };
  }
  try {
    const { error } = await getResend().emails.send({
      from: fromAddress(),
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (error) return { ok: false, error: String(error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

// Minimal, email-client-safe branded shell (inline styles only).
export function emailShell(title: string, bodyHtml: string): string {
  return `<div style="background:#eaeef4;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:#2ea6d8;padding:18px 24px;">
      <span style="color:#ffffff;font-size:18px;font-weight:800;">Paws Playcare</span>
    </div>
    <div style="padding:24px;color:#333a41;">
      <h1 style="margin:0 0 12px;font-size:20px;">${title}</h1>
      ${bodyHtml}
    </div>
    <div style="padding:16px 24px;background:#f8fafc;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0;">
      Paws Playcare · Card details handled securely by Stripe.
    </div>
  </div>
</div>`;
}
