-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "suspendedAt" DATETIME,
    "suspendReason" TEXT,
    "address" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "payCadence" TEXT NOT NULL DEFAULT 'WEEKLY',
    "servicesPaused" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "regStartDate" DATETIME,
    "regSlots" TEXT NOT NULL DEFAULT '[]',
    "agreedTermsAt" DATETIME,
    "stripeCustomerId" TEXT,
    "paymentMethodId" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardExpMonth" INTEGER,
    "cardExpYear" INTEGER,
    "cardExpiryNotifiedAt" DATETIME,
    "canWork" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_User" ("address", "approvedAt", "approvedById", "canWork", "cardBrand", "cardExpMonth", "cardExpYear", "cardExpiryNotifiedAt", "cardLast4", "createdAt", "email", "emergencyName", "emergencyPhone", "id", "name", "notes", "passwordHash", "payCadence", "paymentMethodId", "phone", "role", "servicesPaused", "status", "stripeCustomerId", "suspendReason", "suspendedAt", "updatedAt") SELECT "address", "approvedAt", "approvedById", "canWork", "cardBrand", "cardExpMonth", "cardExpYear", "cardExpiryNotifiedAt", "cardLast4", "createdAt", "email", "emergencyName", "emergencyPhone", "id", "name", "notes", "passwordHash", "payCadence", "paymentMethodId", "phone", "role", "servicesPaused", "status", "stripeCustomerId", "suspendReason", "suspendedAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
