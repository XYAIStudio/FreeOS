import assert from "node:assert/strict";
import {
  corsAllowsSelf,
  isAllowedCorsOrigin,
  mergeCorsOrigins,
  parseOriginList,
  sidecarSelfOrigins,
} from "../backend/utils/cors-origins";

assert.deepEqual(sidecarSelfOrigins(3780), [
  "http://127.0.0.1:3780",
  "http://localhost:3780",
  "http://[::1]:3780",
]);
assert.deepEqual(sidecarSelfOrigins(" 18900 "), [
  "http://127.0.0.1:18900",
  "http://localhost:18900",
  "http://[::1]:18900",
]);

const staleDashboardOnly = ["http://127.0.0.1:8088", "http://localhost:8088"];
const merged = mergeCorsOrigins(staleDashboardOnly, 3780);
assert.ok(merged.includes("http://127.0.0.1:8088"));
assert.ok(merged.includes("http://127.0.0.1:3780"));
assert.ok(merged.includes("http://localhost:3780"));
assert.ok(merged.includes("http://[::1]:3780"));
assert.equal(corsAllowsSelf(merged, 3780), true);
assert.equal(corsAllowsSelf(staleDashboardOnly, 3780), false);
assert.equal(
  corsAllowsSelf(staleDashboardOnly, 3780, "127.0.0.1:3780"),
  true,
);

assert.deepEqual(parseOriginList("http://a.com, http://b.com"), [
  "http://a.com",
  "http://b.com",
]);

assert.equal(isAllowedCorsOrigin(undefined, merged), true);
assert.equal(isAllowedCorsOrigin("http://127.0.0.1:3780", merged), true);
assert.equal(isAllowedCorsOrigin("http://localhost:3780", merged), true);
assert.equal(isAllowedCorsOrigin("http://[::1]:3780", merged), true);
assert.equal(
  isAllowedCorsOrigin("http://127.0.0.1:3780", staleDashboardOnly, "127.0.0.1:3780"),
  true,
);
assert.equal(isAllowedCorsOrigin("https://evil.example", merged, "127.0.0.1:3780"), false);

console.log("cors origin tests passed");
