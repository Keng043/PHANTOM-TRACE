export const ANALYTICS_CAPABILITIES = [
  "NOTIFICATION",
  "SCREEN_SHARING",
  "INTERACTION_TRACKING",
  "REMOTE_SUPPORT",
  "CAMERA",
] as const;

export type AnalyticsCapability = typeof ANALYTICS_CAPABILITIES[number];
export type PermissionOutcome = "GRANTED" | "DENIED" | "UNAVAILABLE" | "ERROR" | "STOPPED";

type ConsentRow = {
  capability: string;
  granted: boolean;
  grantedAt: Date | null;
  revokedAt: Date | null;
};
type PermissionEvent = { capability: string; outcome: string };
type RoomRow = { status: "PENDING" | "ACTIVE" | "CLOSED" | "EXPIRED"; approvedAt: Date | null; expiresAt?: Date };

export function buildExperimentAnalytics(
  consents: ConsentRow[],
  permissionEvents: PermissionEvent[],
  rooms: RoomRow[],
) {
  const capabilities = Object.fromEntries(ANALYTICS_CAPABILITIES.map((capability) => {
    const records = consents.filter((row) => row.capability === capability);
    const outcomes: Record<PermissionOutcome, number> = {
      GRANTED: 0, DENIED: 0, UNAVAILABLE: 0, ERROR: 0, STOPPED: 0,
    };
    for (const event of permissionEvents) {
      if (event.capability === capability && event.outcome in outcomes) {
        outcomes[event.outcome as PermissionOutcome] += 1;
      }
    }
    return [capability, {
      consented: records.filter((row) => row.grantedAt !== null).length,
      active: records.filter((row) => row.granted && row.revokedAt === null).length,
      withdrawn: records.filter((row) => row.revokedAt !== null).length,
      outcomes,
    }];
  })) as Record<AnalyticsCapability, {
    consented: number;
    active: number;
    withdrawn: number;
    outcomes: Record<PermissionOutcome, number>;
  }>;

  const now = new Date();
  const effectiveStatus = (room: RoomRow) =>
    room.expiresAt && room.expiresAt <= now && (room.status === "PENDING" || room.status === "ACTIVE")
      ? "EXPIRED" : room.status;
  const remote = {
    invitations: rooms.length,
    approved: rooms.filter((room) => room.approvedAt !== null).length,
    pending: rooms.filter((room) => effectiveStatus(room) === "PENDING").length,
    active: rooms.filter((room) => effectiveStatus(room) === "ACTIVE").length,
    closed: rooms.filter((room) => effectiveStatus(room) === "CLOSED").length,
    expired: rooms.filter((room) => effectiveStatus(room) === "EXPIRED").length,
  };

  return { capabilities, remote };
}
