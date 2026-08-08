// One-off admin password reset — for when email-based reset isn't working.
// Run on the server (Plesk → Node.js → Run Node.js commands):
//     npm run reset-admin
// Resets kitty@pawsplaycare.co.uk to a fresh random password (and guarantees
// the account is ADMIN + ACTIVE), then PRINTS the new password so you can pass
// it to Kitty. She logs in at /PPC and changes it in the app.
//
// Reset a different account:  npm run reset-admin -- someone@example.com
// Set a specific password:    npm run reset-admin -- kitty@pawsplaycare.co.uk MyPass123

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const email = (process.argv[2] || "kitty@pawsplaycare.co.uk").trim().toLowerCase();
// A readable, strong temporary password unless one is supplied.
const password =
  process.argv[3] ||
  process.env.NEW_PASSWORD ||
  `Paws-${crypto.randomBytes(3).toString("hex")}-${crypto.randomBytes(3).toString("hex")}`;

const existing = await prisma.user.findUnique({ where: { email } });
const hash = await bcrypt.hash(password, 10);
// Optional 4th arg = name (only used when creating). Sensible default for Kitty.
const name =
  existing?.name ||
  process.argv[4] ||
  (email === "kitty@pawsplaycare.co.uk" ? "Kitty Cole" : email.split("@")[0]);

await prisma.user.upsert({
  where: { email },
  update: {
    passwordHash: hash,
    role: "ADMIN",
    status: "ACTIVE",
    canWork: true,
    archivedAt: null,
    suspendedAt: null,
    suspendReason: null,
  },
  create: {
    email,
    name,
    passwordHash: hash,
    role: "ADMIN",
    status: "ACTIVE",
    canWork: true,
    approvedAt: new Date(),
  },
});

console.log(`\n✅ ${existing ? "Password reset" : "Admin account CREATED"} for ${email}`);
console.log(`   Name:      ${name}`);
console.log(`   Password:  ${password}`);
console.log(`   Role: ADMIN · status: ACTIVE`);
console.log(`   → Log in at /PPC and change the password in the app.\n`);

await prisma.$disconnect();
