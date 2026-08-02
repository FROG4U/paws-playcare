# Paws Playcare — Go-Live Runbook (IONOS / Plesk → pawsplaycare.co.uk)

This app is a **live Node.js server** (Next.js 16 + Prisma/SQLite), not static files.
It needs a host that runs a Node process with persistent disk + HTTPS.

---

## ⚠️ STEP 0 — Confirm your plan can run Node.js (do this first)

Standard IONOS **Web Hosting** plans (the PHP/WordPress ones) **cannot run a Node
app** — only a VPS or a plan with the Plesk **Node.js** extension can.

In Plesk, check the left menu for a **"Node.js"** entry on the domain, or
Extensions → look for "Node.js". If it's there → you're good. If not, you need an
**IONOS VPS with Plesk** (Node.js extension is free to add).

👉 Tell me which you have and I'll tailor the rest. Everything below assumes
Plesk with Node.js.

---

## STEP 1 — Get the code onto GitHub (so deploys are repeatable)

The project is a local git repo with no remote yet.

1. Create a **private** repo at github.com (e.g. `paws-playcare`).
2. From the project folder:
   ```bash
   git add -A && git commit -m "Production-ready"
   git remote add origin git@github.com:YOURNAME/paws-playcare.git
   git push -u origin main
   ```
   (`.env` and `dev.db` are gitignored — they never leave your machine.)

Plesk can then pull from GitHub (Git tab), or you upload a zip. Git is easier for
future updates.

---

## STEP 2 — Prepare production values (before touching the server)

- **Wipe test data.** The dev DB has test accounts (Jane, Bella, Danu H…). Go
  live with a fresh empty DB — do NOT copy `dev.db` up. First deploy creates the
  schema (Step 5). Re-create the admin login there.
- **Live Stripe keys.** Switch Stripe to live mode → copy `sk_live_…` and
  `pk_live_…`. ⚠️ Your Stripe account is currently tied to *SimplyBook.me* —
  confirm you can use it for the new app (or make a standalone account) before
  taking real payments.
- **Secrets.** Generate fresh `AUTH_SECRET` and `CRON_SECRET`:
  ```bash
  openssl rand -base64 32
  ```
- (Optional) **Resend** API key + verified `EMAIL_FROM` if you want real emails now.

See `.env.example` for the full list.

---

## STEP 3 — Create the Node.js app in Plesk

Plesk → your domain → **Node.js**:

- **Node.js version:** 20 or 22 (LTS).
- **Application Root:** the folder holding the code (e.g. `httpdocs` or a subdir).
- **Application Startup File:** `server.js`  ← already in the repo.
- **Application Mode:** `production`.
- Leave "Application URL" as the domain.

Don't click "Enable Node.js" until env vars + build are done (Steps 4–5).

---

## STEP 4 — Environment variables

Plesk → Node.js → **"Custom environment variables"** (or a `.env` file in the app
root). Set every key from `.env.example` with production values:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | `file:/var/www/vhosts/pawsplaycare.co.uk/data/prod.db` (an **absolute path outside the code folder** so redeploys don't wipe it — create that `data/` folder) |
| `AUTH_SECRET` | your generated secret |
| `NEXT_PUBLIC_APP_URL` | `https://pawsplaycare.co.uk` |
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | from Step 7 |
| `CRON_SECRET` | your generated secret |
| `RESEND_API_KEY` / `EMAIL_FROM` | optional |

---

## STEP 5 — Install, build, create the database

In Plesk → Node.js use the buttons **NPM install** then **Run script → build**,
or over SSH in the app root:

```bash
npm install
npx prisma generate
npx prisma db push        # creates the empty prod DB schema
npm run build
```

Create the first admin account (SSH, one-off):
```bash
node -e "require('./prisma/seed.mjs')"   # seeds admin@pawsplaycare.co.uk / admin1234 — CHANGE the password after first login
```

Then **Enable Node.js / Restart App** in Plesk.

---

## STEP 6 — Scheduled jobs (cron)

Plesk → **Scheduled Tasks** → add three, each a "Fetch a URL" (or curl), all
using your `CRON_SECRET`:

| When | URL |
|------|-----|
| Daily **19:00** | `https://pawsplaycare.co.uk/api/cron/finalize-invoices?key=CRON_SECRET` |
| Daily **21:00** | `https://pawsplaycare.co.uk/api/cron/charge-invoices?key=CRON_SECRET` |
| Daily **08:00** | `https://pawsplaycare.co.uk/api/cron/maintenance?key=CRON_SECRET` |

(finalize = send invoices, charge = take payment, maintenance = card-expiry +
unpaid blocks.)

---

## STEP 7 — Domain + HTTPS + Stripe webhook

Since we're **replacing the current site** on the apex domain:

1. Point **pawsplaycare.co.uk** at this Plesk server. If the domain already lives
   in this IONOS/Plesk account, just host the app on it. If DNS is elsewhere, set
   the **A record** to the server's IP (and `www` CNAME → apex). Allow up to a few
   hours to propagate.
2. Plesk → **SSL/TLS Certificates** → issue a free **Let's Encrypt** cert for
   `pawsplaycare.co.uk` + `www`. Turn on "redirect HTTP → HTTPS". (HTTPS is
   required for the installable app, Stripe, and secure logins.)
3. Stripe → Developers → **Webhooks** → add endpoint
   `https://pawsplaycare.co.uk/api/stripe/webhook` → copy the `whsec_…` into
   `STRIPE_WEBHOOK_SECRET` and restart the app.
   *(Note: a dedicated webhook route isn't wired yet — ping me to add it when you
   move to live charging; the cron-based charging works without it.)*

---

## STEP 8 — After it's live, check

- [ ] Home page loads over HTTPS at pawsplaycare.co.uk
- [ ] Register a real client → approve as admin → add a card → book → complete →
      invoice → nightly charge
- [ ] "Install app" works on a phone (Add to Home Screen)
- [ ] Change the seeded admin password
- [ ] Old WordPress/SimplyBook data migrated or exported (existing customers won't
      have accounts here until they register)

---

### Updating later
Push to GitHub → in Plesk pull + **NPM install** + **build** + **Restart App**.
(I can add a GitHub Actions workflow to automate this once I have your deploy
method — SSH or Plesk Git.)
