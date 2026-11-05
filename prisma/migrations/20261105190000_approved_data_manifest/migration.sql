CREATE TYPE "ApprovedDataField" AS ENUM (
  'USAGE_EVENTS',
  'INTERACTION_SIGNALS',
  'COARSE_DEVICE_PROFILE',
  'PERMISSION_OUTCOMES'
);

CREATE TABLE "DataFieldConsent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "dataField" "ApprovedDataField" NOT NULL,
  "granted" BOOLEAN NOT NULL DEFAULT true,
  "policyVersion" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DataFieldConsent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DataFieldConsent_sessionId_dataField_key"
  ON "DataFieldConsent"("sessionId", "dataField");
CREATE INDEX "DataFieldConsent_dataField_granted_revokedAt_idx"
  ON "DataFieldConsent"("dataField", "granted", "revokedAt");
ALTER TABLE "DataFieldConsent"
  ADD CONSTRAINT "DataFieldConsent_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
