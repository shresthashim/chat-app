import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { notFoundHandler, errorHandler } from "./middleware/error.middleware.js";
import * as health from "./modules/health/health.controller.js";
import authRoutes from "./modules/auth/auth.routes.js";
import userRoutes from "./modules/users/users.routes.js";
import conversationRoutes from "./modules/conversations/conversations.routes.js";
import messageSearchRoutes from "./modules/messages/search.routes.js";
import uploadRoutes from "./modules/uploads/uploads.routes.js";
import callRoutes from "./modules/calls/calls.routes.js";

function formatRequestLog(req: { method?: string; url?: string }, statusCode: number, responseTime: number): string {
  return `${req.method ?? "REQUEST"} ${req.url ?? ""} ${statusCode} ${Math.round(responseTime)}ms`;
}

export function createApp(): Express {
  const app = express();

  // Behind Render's proxy: trust it so secure cookies and rate limiting work.
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow same-origin / non-browser requests (no Origin header).
        if (!origin || env.CLIENT_ORIGINS.includes(origin)) return callback(null, true);
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      },
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === "/api/health" },
      customSuccessMessage: (req, res, responseTime) =>
        formatRequestLog(req, res.statusCode, responseTime),
      customErrorMessage: (req, res, error) =>
        `${req.method ?? "REQUEST"} ${req.url ?? ""} ${res.statusCode} - ${error.message}`,
      serializers: {
        req(req) {
          return {
            id: req.id,
            method: req.method,
            url: req.url,
          };
        },
        res(res) {
          return {
            statusCode: res.statusCode,
          };
        },
      },
    }),
  );

  // Service banner + liveness probe (registered before the rate limiter so the
  // health check is never throttled).
  app.get("/", health.getServiceInfo);
  app.get("/api/health", health.getHealth);

  app.use("/api", apiLimiter);
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/conversations", conversationRoutes);
  app.use("/api/messages", messageSearchRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/calls", callRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
