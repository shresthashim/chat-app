import type { Request, Response } from "express";
import mongoose from "mongoose";
import { env } from "../../config/env.js";
import { sendSuccess } from "../../utils/apiResponse.js";

const SERVICE_NAME = "ChatHub API";
const SERVICE_VERSION = process.env.npm_package_version ?? "1.0.0";

// Maps mongoose's numeric connection.readyState to a readable label.
const DB_STATES: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

function databaseStatus(): string {
  return DB_STATES[mongoose.connection.readyState] ?? "unknown";
}

/**
 * Root route — a lightweight banner identifying the service. Useful so hitting
 * the API's base URL returns something meaningful instead of a 404.
 */
export function getServiceInfo(_req: Request, res: Response): void {
  sendSuccess(res, {
    name: SERVICE_NAME,
    version: SERVICE_VERSION,
    status: "running",
    health: "/api/health",
    timestamp: new Date().toISOString(),
  });
}

/**
 * Liveness probe (used by Render's health check). Always 200 while the process
 * is up so a transient database blip doesn't trigger a restart loop; the current
 * database connection state is reported in the body for observability.
 */
export function getHealth(_req: Request, res: Response): void {
  sendSuccess(res, {
    status: "ok",
    uptime: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    version: SERVICE_VERSION,
    database: databaseStatus(),
    timestamp: new Date().toISOString(),
  });
}
