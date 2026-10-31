const SIGNAL_LIMIT_PER_SENDER = 30;

export function isSupportSignalRateLimited(recentCount: number): boolean {
  return recentCount >= SIGNAL_LIMIT_PER_SENDER;
}
