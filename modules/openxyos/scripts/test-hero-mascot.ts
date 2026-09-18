import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mascot = path.join(root, "frontend/public/assets/xyai-mascot.webp");
const home = fs.readFileSync(path.join(root, "frontend/src/pages/OpenHomePage.tsx"), "utf8");
const brand = fs.readFileSync(path.join(root, "frontend/src/brandAssets.ts"), "utf8");
const server = fs.readFileSync(path.join(root, "backend/server.ts"), "utf8");

assert.ok(fs.existsSync(mascot), "hero mascot file missing");
assert.ok(fs.statSync(mascot).size > 1024, "hero mascot looks empty");
assert.match(brand, /xyai-mascot\.webp/);
assert.match(home, /XYAI_MASCOT_SRC/);
assert.doesNotMatch(home, /src="\/assets\/xyai-mascot\.webp"/);
assert.match(server, /xyai-mascot\.webp/);

console.log("hero mascot pack ok");
