export const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;
export const EVENT_WINDOW_MS = 60 * 1000;
export const EVENT_WINDOW_LIMIT = 60;
export const SESSION_EVENT_LIMIT = 1_000;
export const HEARTBEAT_INTERVAL_MS = 25_000;
export const HEARTBEAT_STALE_MS = 90_000;
export const DEVICE_PROFILE_SCHEMA_VERSION = "1";
export const TRACKING_RETENTION_DAYS = 90;

export function getSessionExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_MAX_AGE_MS);
}

export function isSessionExpired(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function isHeartbeatStale(lastSeenAt: Date, now = new Date()): boolean {
  return now.getTime() - lastSeenAt.getTime() > HEARTBEAT_STALE_MS;
}
