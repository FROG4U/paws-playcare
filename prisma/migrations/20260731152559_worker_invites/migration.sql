-- CreateTable
CREATE TABLE "WorkerInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "usedByUserId" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerInvite_token_key" ON "WorkerInvite"("token");
