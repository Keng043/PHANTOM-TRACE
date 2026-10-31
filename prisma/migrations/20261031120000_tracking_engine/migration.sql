-- Tracking Engine: bounded session lifetime, event quotas, idempotency and coarse device profile.
ALTER TYPE "EventType" ADD VALUE IF NOT EXISTS 'DEVICE_PROFILE_RECORDED';

ALTER TABLE "Session"
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "eventCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "eventWindowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "eventWindowCount" INTEGER NOT NULL DEFAULT 0;

-- Existing sessions receive a bounded expiry based on their original start time.
UPDATE "Session" SET
  "expiresAt" = "startedAt" + INTERVAL '2 hours',
  "lastSeenAt" = COALESCE("endedAt", "startedAt"),
  "lastHeartbeatAt" = "startedAt",
  "eventWindowStartedAt" = "startedAt"
WHERE "expiresAt" IS NULL;

ALTER TABLE "Session" ALTER COLUMN "expiresAt" SET NOT NULL;

ALTER TABLE "Event" ADD COLUMN "clientEventId" TEXT;
CREATE UNIQUE INDEX "Event_clientEventId_key" ON "Event"("clientEventId");
CREATE INDEX "Session_expiresAt_endedAt_idx" ON "Session"("expiresAt", "endedAt");
CREATE INDEX "Session_lastSeenAt_idx" ON "Session"("lastSeenAt");

ALTER TABLE "DeviceProfile" ADD COLUMN "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
