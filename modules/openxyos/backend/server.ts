import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { initDatabase } from "./db";
import { authRoutes } from "./routes/auth";
import { employeeRoutes } from "./routes/employees";
import { taskRoutes } from "./routes/tasks";
import { chatRoutes } from "./routes/chats";
import { orgRoutes } from "./routes/org";
import { knowledgeRoutes } from "./routes/knowledge";
import { healthRoutes } from "./routes/health";
import { notificationRoutes } from "./routes/notifications";
import { dashboardRoutes } from "./routes/dashboard";
import { settingsRoutes } from "./routes/settings";
import { openModuleSettingsRoutes } from "./routes/open-module-settings";
import { aiRoutes } from "./routes/ai";
import { tenantRoutes } from "./routes/tenants";
import { employeeCodeRoutes } from "./routes/employee-code";
import { memoryRoutes } from "./routes/memory";
import { heartbeatRoutes } from "./routes/heartbeat";
import { orchestrateRoutes } from "./routes/orchestrate";
import { goalRoutes } from "./routes/goals";
import { budgetRoutes } from "./routes/budgets";
import { routineRoutes } from "./routes/routines";
import { performanceRoutes } from "./routes/performance";
import { reflectionRoutes } from "./routes/reflections";
import { configVersionRoutes } from "./routes/config-versions";
import { orgImportRoutes } from "./routes/org-import";
import { skillsRoutes } from "./routes/skills";
import { auditRoutes } from "./routes/audit";
import { efficiencyRoutes } from "./routes/efficiency";
import { governanceRoutes } from "./routes/governance";
import { workflowRoutes } from "./routes/workflow";
import { talentRoutes } from "./routes/talent";
import { pluginRoutes } from "./routes/plugins";
import adminRoutes from "./routes/admin";
import { contractRoutes } from "./routes/contracts";
import { assetRoutes } from "./routes/assets";
import { paymentRoutes } from "./routes/payments";
import reviewsRoutes from "./routes/reviews";
import { announcementRoutes } from "./routes/announcements";
import { analyticsRoutes } from "./routes/analytics";
import { assistantRoutes } from "./routes/assistant";
import { freeosBridgeRoutes } from "./routes/freeos-bridge";
import { seedDatabase } from "./seed";
import { authenticate } from "./middleware";
import { setupWebSocket } from "./services/websocket";
import { globalErrorHandler } from "./utils/error-handler";
import {
  isAllowedCorsOrigin,
  mergeCorsOrigins,
  parseOriginList,
} from "./utils/cors-origins";

async function main() {
  const app = express();
  const server = createServer(app);
  const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  // 信任 nginx 代理（修复 X-Forwarded-For 报错）
  app.set("trust proxy", 1);

  // 安全头。FreeOS embeds this sidecar in the Organization preview iframe
  // (dashboard origin is a different port on 127.0.0.1). Default helmet
  // frameguard is SAMEORIGIN and blanks that preview.
  const embeddable = Boolean(process.env.FREEOS_HOME || process.env.AIR_GAP_MODE === "true");
  app.use(helmet({
    contentSecurityPolicy: false,        // CSP 由 Vite 构建层管理
    crossOriginEmbedderPolicy: false,
    ...(embeddable ? { frameguard: false as const } : {}),
  }));
  if (embeddable) {
    app.use((_req, res, next) => {
      res.setHeader(
        "Content-Security-Policy",
        "frame-ancestors 'self' http://127.0.0.1:* http://localhost:* http://[::1]:*",
      );
      next();
    });
  }

  // CORS — 白名单 + 本机 sidecar 自源（iframe 登录）+ WebView 兼容
  const defaultOrigins = [
    "http://localhost:5173", "http://localhost:5174", "http://localhost:3000",
    "http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://127.0.0.1:3000",
    "https://os.cnxy.tech", "https://www.os.cnxy.tech",
  ];
  const configuredOrigins = parseOriginList(process.env.CORS_ORIGIN);
  const allowedOrigins = mergeCorsOrigins(
    configuredOrigins.length ? configuredOrigins : defaultOrigins,
    PORT,
  );
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    // WebView 从 resource:// rawfile 加载时 origin 为空/null，本地开发放行
    if (!origin) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-FreeOS-Ingest-Token");
      if (req.method === "OPTIONS") return res.sendStatus(200);
      return next();
    }
    cors({
      origin: (o, cb) => {
        if (isAllowedCorsOrigin(o, allowedOrigins, req.headers.host)) {
          cb(null, true);
        } else {
          cb(null, false);
        }
      },
      credentials: true,
    })(req, res, next);
  });

  app.use(express.json({ limit: "10mb" }));
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret) {
  console.error("[FATAL] COOKIE_SECRET not set, check .env");
  process.exit(1);
}
app.use(cookieParser(cookieSecret));

  // 全局速率限制（每个IP每分钟300次）
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "请求过于频繁，请稍后再试" },
  });
  app.use("/api", globalLimiter);

  // AI接口严格限流（每IP每分钟20次）
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "AI请求频率超限，请稍后再试" },
  });
  app.use("/api/ai", aiLimiter);

  // 登录接口严格限流（每IP每分钟10次，防暴力破解）
  const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "登录尝试过多，请稍后再试" },
  });
  app.use("/api/auth/login", authLimiter);

  const distPath = path.join(__dirname, "../dist");
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  const brandAssetNames = new Set([
    "xyai-mascot.webp",
    "xyos-water-logo.png",
    "openxyos-agent-journey-demo.png",
  ]);
  app.get("/assets/:file", (req, res, next) => {
    const name = path.basename(String(req.params.file || ""));
    if (!brandAssetNames.has(name)) return next();
    const candidates = [
      path.join(distPath, "assets", name),
      path.join(__dirname, "../frontend/public/assets", name),
      path.join(__dirname, "../public/assets", name),
    ];
    const found = candidates.find((candidate) => fs.existsSync(candidate));
    if (!found) return next();
    return res.sendFile(found);
  });

  // 知识库上传文件静态服务
  const uploadPath = path.join(__dirname, "../uploads");
  if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
  // 文件上传目录 — 需认证访问（租户隔离）
  app.use("/uploads", authenticate, (req: any, res, next) => {
    const tenantId = req.user?.tenant_id;
    if (tenantId) {
      res.setHeader("X-Tenant-ID", String(tenantId));
    }
    next();
  }, express.static(uploadPath));

  app.use("/api/auth", authRoutes);
  app.use("/api/employees", employeeRoutes);
  app.use("/api/employee-code", employeeCodeRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/chats", chatRoutes);
  app.use("/api/org", orgRoutes);
  app.use("/api/knowledge", knowledgeRoutes);
  app.use("/api/health", healthRoutes);
  app.use("/api/freeos", freeosBridgeRoutes);
  app.use("/api/notifications", notificationRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/settings", settingsRoutes);
  app.use("/api/module-settings", openModuleSettingsRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/tenants", tenantRoutes);
    app.use("/api/memory", memoryRoutes);
  app.use("/api/heartbeat", heartbeatRoutes);
  app.use("/api/orchestrate", orchestrateRoutes);
  app.use("/api/goals", goalRoutes);
  app.use("/api/budgets", budgetRoutes);
  app.use("/api/routines", routineRoutes);
  app.use("/api/performance", performanceRoutes);
  app.use("/api/reflections", reflectionRoutes);
  app.use("/api/config-versions", configVersionRoutes);
  app.use("/api/org-import", orgImportRoutes);
  app.use("/api/skills", skillsRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/efficiency", efficiencyRoutes);
  app.use("/api/governance", governanceRoutes);
  app.use("/api/workflows", workflowRoutes);
app.use("/api/talent", talentRoutes);
app.use("/api/plugins", pluginRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/assets", assetRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewsRoutes);  // V4.1 人在回路
app.use("/api/announcements", announcementRoutes);  // P25 通知公告
app.use("/api/analytics", analyticsRoutes);          // P28 访问统计
app.use("/api/assistant", assistantRoutes);          // P28 智能助手

  // 全局错误处理中间件（必须在所有路由之后注册）
  app.use(globalErrorHandler);

  // V4: 数据库管理页面（页面内 JS 自行鉴权）
app.get("/admin/database", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist/database-admin.html"));
});

  app.get("*", (req, res) => {
    const indexPath = fs.existsSync(path.join(distPath, "index.html"))
      ? path.join(distPath, "index.html")
      : path.join(__dirname, "../frontend/index.html");
    res.sendFile(indexPath);
  });

  await initDatabase();
  seedDatabase();

  setupWebSocket(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  🌐 openXYOS Community — Human + Agent OS`);
    console.log(`  ─────────────────────────────────────`);
    console.log(`  Server:     http://localhost:${PORT}`);
    console.log(`  WebSocket:  ws://localhost:${PORT}/ws`);
    console.log(`  Status:     ✅ Running\n`);
  });
}

// ═══════════════════════════════════════════════════════════
// 全局未捕获异常处理 — 防进程崩溃
// ═══════════════════════════════════════════════════════════
process.on("uncaughtException", (err) => {
  console.error("[FATAL] 未捕获的同步异常:", err.message);
  console.error("[FATAL] Stack:", err.stack?.slice(0, 500));
  if (process.env.NODE_ENV === "production") {
    console.error("[FATAL] exiting, container will restart");
    process.exit(1);
  } // PM2 会在检测到进程僵死时自动重启
});

process.on("unhandledRejection", (reason: any, promise) => {
  console.error("[FATAL] 未处理的Promise rejection:", reason?.message || reason);
  if (reason?.stack) console.error("[FATAL] Stack:", reason.stack.slice(0, 500));
  if (process.env.NODE_ENV === "production") {
    console.error("[FATAL] exiting, container will restart");
    process.exit(1);
  }
});

main().catch(console.error);
