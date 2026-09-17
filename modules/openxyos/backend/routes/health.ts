import { Router } from "express";
import { dbGet } from "../db";
import {
  corsAllowsSelf,
  mergeCorsOrigins,
  parseOriginList,
} from "../utils/cors-origins";

export const healthRoutes = Router();

function listenPort(): string {
  return String(process.env.PORT ?? "3780").trim() || "3780";
}

function selfOriginAllowed(): boolean {
  const port = listenPort();
  const configured = parseOriginList(process.env.CORS_ORIGIN);
  const allowed = mergeCorsOrigins(configured, port);
  return corsAllowsSelf(allowed, port);
}

function checkDatabase() {
  const employees = dbGet("SELECT COUNT(*) as c FROM employees") as any;
  const tasks = dbGet("SELECT COUNT(*) as c FROM tasks") as any;
  const users = dbGet("SELECT COUNT(*) as c FROM users") as any;
  return { employees: employees.c, tasks: tasks.c, users: users.c };
}

healthRoutes.get("/livez", (_req, res) => {
  res.status(200).json({
    status: "live",
    uptime: Math.floor(process.uptime()),
    self_origin_allowed: selfOriginAllowed(),
  });
});

healthRoutes.get("/readyz", (_req, res) => {
  try {
    const stats = checkDatabase();
    res.status(200).json({
      status: "ready",
      version: process.env.XYOS_VERSION || "0.50.0-dev",
      database: "ok",
      uptime: Math.floor(process.uptime()),
      stats,
    });
  } catch {
    res.status(503).json({ status: "not_ready", version: process.env.XYOS_VERSION || "0.50.0-dev", database: "error" });
  }
});

// 兼容既有部署健康检查，同时保证依赖异常时返回非 2xx。
healthRoutes.get("/", (_req, res) => {
  try {
    const stats = checkDatabase();
    res.status(200).json({ status: "ready", version: process.env.XYOS_VERSION || "0.50.0-dev", database: "ok", uptime: Math.floor(process.uptime()), stats });
  } catch {
    res.status(503).json({ status: "not_ready", version: process.env.XYOS_VERSION || "0.50.0-dev", database: "error" });
  }
});
