-- CreateEnum
CREATE TYPE "SupportRoomStatus" AS ENUM ('PENDING', 'ACTIVE', 'CLOSED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SupportSignalKind" AS ENUM ('OFFER', 'ANSWER', 'ICE');

-- CreateEnum
CREATE TYPE "SupportSignalSender" AS ENUM ('PARTICIPANT', 'STAFF');

-- CreateTable
CREATE TABLE "SupportRoom" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "SupportRoomStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportSignal" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "sender" "SupportSignalSender" NOT NULL,
    "kind" "SupportSignalKind" NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupportRoom_sessionId_key" ON "SupportRoom"("sessionId");

-- CreateIndex
CREATE INDEX "SupportRoom_status_expiresAt_idx" ON "SupportRoom"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "SupportRoom_createdById_createdAt_idx" ON "SupportRoom"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "SupportSignal_roomId_createdAt_idx" ON "SupportSignal"("roomId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupportRoom" ADD CONSTRAINT "SupportRoom_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRoom" ADD CONSTRAINT "SupportRoom_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportSignal" ADD CONSTRAINT "SupportSignal_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "SupportRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
