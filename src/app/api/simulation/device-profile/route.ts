import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasValidOrigin } from "@/lib/security/request";
import { hashSessionSecret, SESSION_COOKIE } from "@/lib/simulation/session";
import { DeviceProfileSchema } from "@/lib/validation/tracking";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const secret = request.cookies.get(SESSION_COOKIE)?.value;
  if (!secret) return NextResponse.json({ error: "Session required." }, { status: 401 });
  const parsed = DeviceProfileSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid device profile." }, { status: 400 });

  const now = new Date();
  const session = await prisma.session.findUnique({
    where: { sessionToken: hashSessionSecret(secret) },
    select: { id: true, endedAt: true, expiresAt: true, consentedAt: true },
  });
  if (!session || !session.consentedAt || session.endedAt || session.expiresAt <= now) {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  const existing = await prisma.deviceProfile.findUnique({
    where: { sessionId: session.id }, select: { id: true },
  });
  if (existing) return NextResponse.json({ ok: true, alreadyRecorded: true }, {
    headers: { "Cache-Control": "no-store" },
  });

  try {
    await prisma.$transaction(async (tx) => {
      await tx.deviceProfile.create({
        data: { sessionId: session.id, ...parsed.data },
      });
      await tx.event.create({
        data: { sessionId: session.id, type: "DEVICE_PROFILE_RECORDED", path: "/simulation/demo" },
      });
    });
  } catch (error) {
    const current = await prisma.deviceProfile.findUnique({
      where: { sessionId: session.id }, select: { id: true },
    });
    if (!current) throw error;
  }

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
