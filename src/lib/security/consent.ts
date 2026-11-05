export const POLICY_VERSION = "2026-11-05-v5";

export function isPermissionValid(recordedAt: Date | null | undefined): boolean {
  return recordedAt instanceof Date && Number.isFinite(recordedAt.getTime());
}
