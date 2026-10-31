export const POLICY_VERSION = "2026-10-31-v2";

export function isPermissionValid(recordedAt: Date | null | undefined): boolean {
  return recordedAt instanceof Date && Number.isFinite(recordedAt.getTime());
}
