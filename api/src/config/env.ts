import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const mongoUriSchemePattern = /^mongodb(?:\+srv)?:\/\//i;

function encodeMongoCredentialPart(value: string): string {
  return encodeURIComponent(value).replace(/%25([0-9a-fA-F]{2})/g, "%$1");
}

function normalizeMongoUri(uri: string): string {
  const match = uri.match(mongoUriSchemePattern);

  if (!match) return uri;

  const scheme = match[0];
  const credentialSeparatorIndex = uri.lastIndexOf("@");

  if (credentialSeparatorIndex < scheme.length) return uri;

  const credentials = uri.slice(scheme.length, credentialSeparatorIndex);
  const passwordSeparatorIndex = credentials.indexOf(":");

  if (passwordSeparatorIndex === -1) return uri;

  const username = credentials.slice(0, passwordSeparatorIndex);
  const password = credentials.slice(passwordSeparatorIndex + 1);
  const hostStartIndex = credentialSeparatorIndex + 1;
  const remainingUri = uri.slice(hostStartIndex);
  const authorityEndOffset = remainingUri.search(/[/?#]/);
  const hostEndIndex =
    authorityEndOffset === -1 ? uri.length : hostStartIndex + authorityEndOffset;
  const hosts = uri.slice(hostStartIndex, hostEndIndex);
  const rest = uri.slice(hostEndIndex);

  return `${scheme}${encodeMongoCredentialPart(username)}:${encodeMongoCredentialPart(password)}@${hosts}${rest}`;
}

/**
 * Centralized, validated environment configuration.
 * The app refuses to boot with an invalid/missing config rather than
 * failing mysteriously at runtime.
 */
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(5000),
    CLIENT_ORIGINS: z
      .string()
      .default("http://localhost:3000")
      .transform((value) =>
        value
          .split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      ),

    MONGO_URI: z.string().min(1, "MONGO_URI is required").transform(normalizeMongoUri),

    JWT_ACCESS_SECRET: z.string().min(16, "JWT_ACCESS_SECRET must be at least 16 chars"),
    JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET must be at least 16 chars"),
    JWT_ACCESS_TTL: z.string().default("15m"),
    JWT_REFRESH_TTL: z.string().default("7d"),

    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
    COOKIE_DOMAIN: z.string().optional(),

    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),

    // Calls (WebRTC). STUN is always free/public; TURN is optional and only
    // needed for the ~15-20% of networks that can't connect peer-to-peer.
    // Provide TURN_URL + TURN_SECRET (coturn `use-auth-secret`) to enable relay.
    STUN_URLS: z
      .string()
      .default("stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302")
      .transform((value) =>
        value
          .split(",")
          .map((url) => url.trim())
          .filter(Boolean),
      ),
    TURN_URL: z.string().optional(),
    TURN_SECRET: z.string().optional(),
    TURN_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  })
  .superRefine((env, ctx) => {
    if (env.COOKIE_SAMESITE === "none" && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["COOKIE_SECURE"],
        message: 'COOKIE_SECURE must be true when COOKIE_SAMESITE is "none"',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

export const isProd = env.NODE_ENV === "production";
export const isDev = env.NODE_ENV === "development";

/** Whether Cloudinary is fully configured for media uploads. */
export const isUploadsEnabled = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET,
);

/** Whether a TURN relay is configured (otherwise calls are STUN-only / P2P). */
export const isTurnEnabled = Boolean(env.TURN_URL && env.TURN_SECRET);
