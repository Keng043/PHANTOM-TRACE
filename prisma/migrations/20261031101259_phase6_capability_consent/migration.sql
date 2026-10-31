-- CreateEnum
CREATE TYPE "ExperimentCapability" AS ENUM ('NOTIFICATION', 'SCREEN_SHARING', 'INTERACTION_TRACKING', 'REMOTE_SUPPORT', 'CAMERA');

-- CreateTable
CREATE TABLE "CapabilityConsent" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "capability" "ExperimentCapability" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapabilityConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapabilityConsent_capability_granted_revokedAt_idx" ON "CapabilityConsent"("capability", "granted", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CapabilityConsent_sessionId_capability_key" ON "CapabilityConsent"("sessionId", "capability");

-- CreateIndex
CREATE INDEX "Participant_createdAt_idx" ON "Participant"("createdAt");

-- AddForeignKey
ALTER TABLE "CapabilityConsent" ADD CONSTRAINT "CapabilityConsent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
