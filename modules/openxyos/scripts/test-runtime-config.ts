import assert from "node:assert/strict";
import { assertModelEndpointAllowed, getRuntimeConfig } from "../backend/config/runtime";

const originalEnv = { ...process.env };

function setEnvironment(values: Record<string, string | undefined>) {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv, values);
}

function expectThrow(fn: () => unknown, message: string) {
  assert.throws(fn, undefined, message);
}

try {
  setEnvironment({
    NODE_ENV: "development",
    DEPLOY_MODE: "",
    JWT_SECRET: "development-only-secret-with-at-least-32-characters",
    COOKIE_SECRET: "development-cookie-secret-with-at-least-32-chars",
    CORS_ORIGIN: "http://localhost:5173",
    DB_DIALECT: "sqlite",
    AIR_GAP_MODE: "false",
  });
  assert.equal(getRuntimeConfig().privateProduction, false);

  setEnvironment({
    NODE_ENV: "development",
    DEPLOY_MODE: "",
    JWT_SECRET: "production-secret-that-is-longer-than-32-characters-001",
    COOKIE_SECRET: "production-cookie-secret-longer-than-32-characters-001",
    CORS_ORIGIN: "http://localhost:5173",
    DB_DIALECT: "sqlite",
    AIR_GAP_MODE: "true",
    MODEL_ENDPOINT_ALLOWLIST: "ollama,localhost",
  });
  assert.equal(assertModelEndpointAllowed("http://ollama:11434/v1"), true);
  assert.equal(assertModelEndpointAllowed("https://example.com/v1"), false);

  setEnvironment({
    NODE_ENV: "production",
    DEPLOY_MODE: "private",
    CORS_ORIGIN: "https://os.cnxy.tech",
    DB_DIALECT: "kingbase",
  });
  expectThrow(() => getRuntimeConfig(), "private production must reject an unwired database adapter");

  setEnvironment({ DB_DIALECT: "sqlite" });
  expectThrow(() => getRuntimeConfig(), "private production must reject SQLite");

  setEnvironment({ DB_DIALECT: "kingbase", CORS_ORIGIN: "*" });
  expectThrow(() => getRuntimeConfig(), "private production must reject wildcard CORS");

  console.log("runtime configuration tests passed");
} finally {
  setEnvironment(originalEnv);
}
