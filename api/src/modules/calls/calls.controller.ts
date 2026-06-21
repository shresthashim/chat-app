import { createHmac } from "node:crypto";
import type { Request, Response } from "express";
import { env, isTurnEnabled } from "../../config/env.js";
import { sendSuccess } from "../../utils/apiResponse.js";

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * ICE servers for the browser's RTCPeerConnection.
 *
 * STUN (free/public) is always returned. TURN is added only when a relay is
 * configured, with **short-lived HMAC credentials** in coturn's
 * `use-auth-secret` REST format: the username embeds an expiry timestamp and
 * the credential is HMAC-SHA1(secret, username). They expire after TURN_TTL,
 * so a leaked credential can't be reused to abuse the relay's bandwidth.
 */
export function getIceServers(req: Request, res: Response): void {
  const iceServers: IceServer[] = [{ urls: env.STUN_URLS }];

  if (isTurnEnabled) {
    const expiry = Math.floor(Date.now() / 1000) + env.TURN_TTL_SECONDS;
    const username = `${expiry}:${req.user?.id ?? "anon"}`;
    const credential = createHmac("sha1", env.TURN_SECRET!).update(username).digest("base64");
    iceServers.push({ urls: env.TURN_URL!, username, credential });
  }

  sendSuccess(res, { iceServers, ttl: env.TURN_TTL_SECONDS });
}
