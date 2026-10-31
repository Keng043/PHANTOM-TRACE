import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hasValidOrigin } from "@/lib/security/request";
import { hashSessionSecret, SESSION_COOKIE } from "@/lib/simulation/session";

export async function POST(request: NextRequest) {
  if (!hasValidOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const secret = request.cookies.get(SESSION_COOKIE)?.value;
  if (secret) {
    const session = await prisma.session.findUnique({
      where: { sessionToken: hashSessionSecret(secret) },
      select: { id: true, endedAt: true },
    });
    if (session && !session.endedAt) {
      await prisma.$transaction(async (tx) => {
        await tx.event.create({ data: { sessionId: session.id, type: "SESSION_ENDED", path: "/simulation/learn" } });
        await tx.session.updateMany({
          where: { id: session.id, endedAt: null },
          data: { endedAt: new Date() },
        });
      });
    }
  }
  const response = NextResponse.json({ ok: true, next: "/simulation/learn" });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0,
  });
  return response;
}
