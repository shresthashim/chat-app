import { pino } from "pino";
import { env, isDev } from "../config/env.js";

/**
 * Structured logger. Pretty-prints in development, JSON in production
 * (which is what Render's log aggregation expects).
 */
export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : isDev ? "debug" : "info",
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"],
    remove: true,
  },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          ignore: "pid,hostname,req,res,responseTime",
          messageFormat: "{msg}",
          translateTime: "SYS:HH:MM:ss",
        },
      }
    : undefined,
});
