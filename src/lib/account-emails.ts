// Branded account-lifecycle emails (welcome, approval, password reset). Each
// no-ops with a log if RESEND_API_KEY isn't set, so nothing breaks in dev.

import { sendEmail, emailShell, baseUrl } from "./email";

const btn = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#2ea6d8;color:#ffffff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:10px;">${label}</a>`;

const p = (text: string) => `<p style="margin:0 0 12px;line-height:1.5;">${text}</p>`;

// Sent right after a client registers (account is pending admin approval).
export async function sendWelcomeEmail(to: string, name: string) {
  const first = name.split(" ")[0] || "there";
  const html = emailShell(
    "Welcome to Paws Playcare! 🐾",
    p(`Hi ${first},`) +
      p("Thanks for signing up. We've received your registration and a member of our team is reviewing your account.") +
      p("Once you're approved we'll email you again — then you can add a payment card and start booking walks.") +
      p(`In the meantime you can sign in any time at ${btn(`${baseUrl()}/online-booking-form`, "Sign in")}`)
  );
  return sendEmail({ to, subject: "Welcome to Paws Playcare 🐾", html });
}

// Sent when an admin approves the client's account. `schedule` is the one-line
// summary of the regular walks set up from their registration, when there are
// any ("Field Play — 36 walks booked, starting Wed 19 Aug, billed weekly.").
export async function sendApprovalEmail(to: string, name: string, schedule?: string | null) {
  const first = name.split(" ")[0] || "there";
  const html = emailShell(
    "Your account is approved! 🎉",
    p(`Hi ${first},`) +
      p("Great news — your Paws Playcare account has been approved.") +
      (schedule
        ? p(`We've booked in the regular walks you asked for: <strong>${schedule}</strong>`) +
          p("Add a payment card so they can go ahead — you can see the full schedule in your account.") +
          p(btn(`${baseUrl()}/client/payment`, "Add a card")) 
        : p("Add a payment card and you're ready to book walks and play sessions.") +
          p(btn(`${baseUrl()}/client/payment`, "Add a card & get started")))
  );
  return sendEmail({ to, subject: "You're approved — welcome to Paws Playcare 🎉", html });
}

// Reminder chasing an active client who still has no payment card on file.
export async function sendCardReminderEmail(to: string, name: string) {
  const first = name.split(" ")[0] || "there";
  const html = emailShell(
    "Add your payment details 🐾",
    p(`Hi ${first},`) +
      p("You're all set up with Paws Playcare — the last step is adding a payment card so we can secure your bookings.") +
      p("<strong>Without a card on file your bookings may be cancelled.</strong> It only takes a minute:") +
      p(btn(`${baseUrl()}/client/payment`, "Add my card"))
  );
  return sendEmail({ to, subject: "Action needed: add your payment details", html });
}

// Sent for a "forgot password" request (contains the single-use reset link).
export async function sendPasswordResetEmail(to: string, rawToken: string) {
  const link = `${baseUrl()}/reset-password?token=${rawToken}`;
  const html = emailShell(
    "Reset your password",
    p("We received a request to reset the password on your Paws Playcare account.") +
      p(btn(link, "Choose a new password")) +
      p("This link expires in 1 hour and can only be used once.") +
      p('<span style="color:#64748b;font-size:13px;">If you didn\'t ask for this, you can safely ignore this email — your password won\'t change.</span>')
  );
  return sendEmail({ to, subject: "Reset your Paws Playcare password", html });
}

// Sent to a client when the admin closes a day their walk was booked on.
export async function sendDayOffEmail(to: string, name: string, dateLabel: string, reason: string) {
  const first = name.split(" ")[0] || "there";
  const safe = reason.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = emailShell(
    `We're closed on ${dateLabel}`,
    p(`Hi ${first},`) +
      p(`Just letting you know we won't be walking on <strong>${dateLabel}</strong>.`) +
      p(`<strong>Reason:</strong> ${safe}`) +
      p("Your walk booked for that day has been cancelled with <strong>no charge</strong> — the rest of your schedule is unaffected.") +
      p("Sorry for any inconvenience, and thanks for understanding! 🐾")
  );
  return sendEmail({ to, subject: `We're not walking on ${dateLabel}`, html });
}
