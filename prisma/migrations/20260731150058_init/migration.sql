-- CreateTable
CREATE TABLE "User" (
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
    "stripeCustomerId" TEXT,
    "paymentMethodId" TEXT,
    "cardBrand" TEXT,
    "cardLast4" TEXT,
    "cardExpMonth" INTEGER,
    "cardExpYear" INTEGER,
    "cardExpiryNotifiedAt" DATETIME,
    "canWork" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Dog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "breed" TEXT,
    "age" TEXT,
    "ageUnderOne" TEXT,
    "neutered" BOOLEAN NOT NULL DEFAULT false,
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
    "negativeReactions" TEXT,
    "houseTrained" BOOLEAN NOT NULL DEFAULT true,
    "triggers" TEXT,
    "otherNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Dog_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "baseWalkPrice" INTEGER NOT NULL DEFAULT 1500,
    "extraDogFee" INTEGER NOT NULL DEFAULT 500,
    "bankHolidayWalkPrice" INTEGER NOT NULL DEFAULT 2250,
    "bankHolidayExtraDogFee" INTEGER NOT NULL DEFAULT 750,
    "workerFlatRate" INTEGER NOT NULL DEFAULT 1000,
    "unpaidGraceDays" INTEGER NOT NULL DEFAULT 7,
    "cardExpiryWarnDays" INTEGER NOT NULL DEFAULT 30,
    "bankHolidayDivision" TEXT NOT NULL DEFAULT 'england-and-wales',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HolidayRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "walkPrice" INTEGER NOT NULL,
    "extraDogFee" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BankHoliday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "division" TEXT NOT NULL DEFAULT 'england-and-wales'
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ONE_OFF',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "dogIds" TEXT NOT NULL DEFAULT '[]',
    "numDogs" INTEGER NOT NULL DEFAULT 1,
    "timeSlot" TEXT NOT NULL DEFAULT 'AM',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "daysOfWeek" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Walk" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookingId" TEXT,
    "clientId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "timeSlot" TEXT NOT NULL DEFAULT 'AM',
    "numDogs" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "assignedWorkerId" TEXT,
    "workerAcceptedAt" DATETIME,
    "completedAt" DATETIME,
    "completedById" TEXT,
    "cancelledAt" DATETIME,
    "cancelReason" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "isBankHoliday" BOOLEAN NOT NULL DEFAULT false,
    "holidayRateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Walk_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Walk_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Walk_assignedWorkerId_fkey" FOREIGN KEY ("assignedWorkerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChangeRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "walkId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "proposedDate" DATETIME,
    "proposedSlot" TEXT,
    "proposedWorkerId" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChangeRequest_walkId_fkey" FOREIGN KEY ("walkId") REFERENCES "Walk" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "cadence" TEXT NOT NULL DEFAULT 'WEEKLY',
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "dueAt" DATETIME,
    "paidAt" DATETIME,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "invoiceId" TEXT NOT NULL,
    "walkId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "InvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceItem_walkId_fkey" FOREIGN KEY ("walkId") REFERENCES "Walk" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Earning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workerId" TEXT NOT NULL,
    "walkId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "numDogs" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'EARNED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Earning_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Earning_walkId_fkey" FOREIGN KEY ("walkId") REFERENCES "Walk" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "BankHoliday_date_key" ON "BankHoliday"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceItem_walkId_key" ON "InvoiceItem"("walkId");

-- CreateIndex
CREATE UNIQUE INDEX "Earning_walkId_key" ON "Earning"("walkId");
