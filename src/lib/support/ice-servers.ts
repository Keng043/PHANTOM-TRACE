import { createHmac } from "node:crypto";

export type IceServerConfig = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export function buildIceServers(subjectId: string, now = Date.now()): IceServerConfig[] {
  const servers: IceServerConfig[] = [{ urls: "stun:stun.l.google.com:19302" }];
  const turnUrls = (process.env.TURN_URL ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const secret = process.env.TURN_SHARED_SECRET;
  if (!turnUrls.length || !secret) return servers;

  const expiresAt = Math.floor(now / 1000) + 20 * 60;
  const username = `${expiresAt}:${subjectId.slice(0, 64)}`;
  const credential = createHmac("sha1", secret).update(username).digest("base64");
  servers.push({ urls: turnUrls, username, credential });
  return servers;
}
