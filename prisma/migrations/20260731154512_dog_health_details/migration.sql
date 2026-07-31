-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Dog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT,
    "age" TEXT,
    "ageUnderOne" TEXT,
    "neutered" BOOLEAN NOT NULL DEFAULT false,
    "healthDetails" TEXT,
    "medicalConditions" BOOLEAN NOT NULL DEFAULT false,
    "medicalDetails" TEXT,
    "vaccinationsCurrent" BOOLEAN NOT NULL DEFAULT false,
    "kennelCoughCurrent" BOOLEAN NOT NULL DEFAULT false,
    "allergies" TEXT,
    "microchipped" BOOLEAN NOT NULL DEFAULT false,
    "insured" BOOLEAN NOT NULL DEFAULT false,
    "aggressionPeople" BOOLEAN NOT NULL DEFAULT false,
    "aggressionAnimals" BOOLEAN NOT NULL DEFAULT false,
    "fenceJumping" BOOLEAN NOT NULL DEFAULT false,
    "possessiveness" BOOLEAN NOT NULL DEFAULT false,
    "socialises" BOOLEAN NOT NULL DEFAULT true,
    "acceptsTreats" BOOLEAN NOT NULL DEFAULT true,
    "obedienceNotes" TEXT,
    "historyBiting" BOOLEAN NOT NULL DEFAULT false,
    "historyGrowling" BOOLEAN NOT NULL DEFAULT false,
    "escapeAttempts" BOOLEAN NOT NULL DEFAULT false,
    "reactedNegatively" BOOLEAN NOT NULL DEFAULT false,
    "negativeReactions" TEXT,
    "houseTrained" BOOLEAN NOT NULL DEFAULT true,
    "triggers" TEXT,
    "otherNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dog_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Dog" ("acceptsTreats", "age", "ageUnderOne", "aggressionAnimals", "aggressionPeople", "allergies", "breed", "createdAt", "escapeAttempts", "fenceJumping", "historyBiting", "historyGrowling", "houseTrained", "id", "insured", "kennelCoughCurrent", "medicalConditions", "medicalDetails", "microchipped", "name", "negativeReactions", "neutered", "obedienceNotes", "otherNotes", "ownerId", "possessiveness", "socialises", "triggers", "vaccinationsCurrent") SELECT "acceptsTreats", "age", "ageUnderOne", "aggressionAnimals", "aggressionPeople", "allergies", "breed", "createdAt", "escapeAttempts", "fenceJumping", "historyBiting", "historyGrowling", "houseTrained", "id", "insured", "kennelCoughCurrent", "medicalConditions", "medicalDetails", "microchipped", "name", "negativeReactions", "neutered", "obedienceNotes", "otherNotes", "ownerId", "possessiveness", "socialises", "triggers", "vaccinationsCurrent" FROM "Dog";
DROP TABLE "Dog";
ALTER TABLE "new_Dog" RENAME TO "Dog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
