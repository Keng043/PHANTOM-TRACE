import { NextRequest } from "next/server";

export function hasValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;

  try {
    const parsed = new URL(origin);
    return parsed.host === host && parsed.protocol === request.nextUrl.protocol;
  } catch {
    return false;
  }
}
