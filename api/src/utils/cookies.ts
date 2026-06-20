import type { CookieOptions, Response } from "express";
import { env } from "../config/env.js";
import { COOKIE_NAMES } from "../config/constants.js";

/** Convert a short duration string ("15m", "7d", "30s", "12h") to milliseconds. */
export function durationToMs(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return value * (multipliers[unit as string] ?? 0);
}

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    domain: env.COOKIE_DOMAIN || undefined,
    path: "/",
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, {
    ...baseCookieOptions(),
    maxAge: durationToMs(env.JWT_ACCESS_TTL),
  });
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, {
    ...baseCookieOptions(),
    maxAge: durationToMs(env.JWT_REFRESH_TTL),
  });
}

export function clearAuthCookies(res: Response): void {
  const options = baseCookieOptions();
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, options);
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, options);
}
