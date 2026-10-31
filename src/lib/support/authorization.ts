import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { POLICY_VERSION } from "@/lib/security/consent";
import { isSupportSignalRateLimited } from "@/lib/support/rate-limit";

const SIGNAL_WINDOW_MS = 60_000;

type SignalInput = {
  roomId: string;
  sender: "PARTICIPANT" | "STAFF";
  kind: "OFFER" | "ANSWER" | "ICE";
  payload: Prisma.InputJsonValue;
  sessionId?: string;
  createdById?: string;
};

export async function writeSupportSignal(input: SignalInput) {
  try {
    return await prisma.$transaction(async (tx) => {
      const now = new Date();
      const room = await tx.supportRoom.findFirst({
        where: {
          id: input.roomId,
          status: "ACTIVE",
          expiresAt: { gt: now },
          ...(input.sessionId ? { sessionId: input.sessionId } : {}),
          ...(input.createdById ? { createdById: input.createdById } : {}),
          session: {
            endedAt: null,
            expiresAt: { gt: now },
            capabilityConsents: {
              some: {
                capability: "REMOTE_SUPPORT",
                granted: true,
                revokedAt: null,
                policyVersion: POLICY_VERSION,
              },
            },
          },
        },
        select: { id: true },
      });
      if (!room) return "inactive" as const;

      const since = new Date(now.getTime() - SIGNAL_WINDOW_MS);
      const recentCount = await tx.supportSignal.count({
        where: { roomId: room.id, sender: input.sender, createdAt: { gte: since } },
      });
      if (isSupportSignalRateLimited(recentCount)) return "rate_limited" as const;

      await tx.supportSignal.create({
        data: {
          roomId: room.id,
          sender: input.sender,
          kind: input.kind,
          payload: input.payload,
        },
      });
      return "created" as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return "retry" as const;
    }
    throw error;
  }
}

export async function approveSupportRoom(sessionId: string) {
  try {
    return await prisma.$transaction(async (tx) => {
      const now = new Date();
      const room = await tx.supportRoom.findFirst({
        where: {
          sessionId,
          status: "PENDING",
          expiresAt: { gt: now },
          session: {
            endedAt: null,
            expiresAt: { gt: now },
            capabilityConsents: {
              some: {
                capability: "REMOTE_SUPPORT",
                granted: true,
                revokedAt: null,
                policyVersion: POLICY_VERSION,
              },
            },
          },
        },
        select: { id: true },
      });
      if (!room) return "inactive" as const;
      const updated = await tx.supportRoom.updateMany({
        where: { id: room.id, status: "PENDING", expiresAt: { gt: now } },
        data: { status: "ACTIVE", approvedAt: now },
      });
      return updated.count === 1 ? "approved" as const : "inactive" as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return "retry" as const;
    }
    throw error;
  }
}
