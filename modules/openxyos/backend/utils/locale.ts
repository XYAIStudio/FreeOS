import type { Request } from "express";

export function isEnglishRequest(req: Pick<Request, "headers">): boolean {
  return String(req.headers["accept-language"] || "").toLowerCase().startsWith("en");
}

export function localizedError(req: Pick<Request, "headers">, zh: string, en: string): string {
  return isEnglishRequest(req) ? en : zh;
}