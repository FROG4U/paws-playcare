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

const user = await prisma.user.findUnique({ where: { email } });
if (!user) {
  console.error(`\n❌ No account found for ${email}. Nothing changed.\n`);
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.user.update({
  where: { email },
  data: {
    passwordHash: await bcrypt.hash(password, 10),
    role: "ADMIN",
    status: "ACTIVE",
    canWork: true,
    archivedAt: null,
    suspendedAt: null,
    suspendReason: null,
  },
});

console.log(`\n✅ Password reset for ${email}`);
console.log(`   Temporary password:  ${password}`);
console.log(`   Account is now ADMIN + ACTIVE.`);
console.log(`   → Log in at /PPC and change the password in the app.\n`);

await prisma.$disconnect();
