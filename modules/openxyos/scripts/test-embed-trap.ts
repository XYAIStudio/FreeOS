import assert from "node:assert/strict";
import {
  isEmbeddedFrame,
  resolveOpenUrl,
  shouldTrapWindowTarget,
} from "../frontend/src/embed/trapWindows";

assert.equal(shouldTrapWindowTarget(undefined), true);
assert.equal(shouldTrapWindowTarget(""), true);
assert.equal(shouldTrapWindowTarget("_blank"), true);
assert.equal(shouldTrapWindowTarget("_BLANK"), true);
assert.equal(shouldTrapWindowTarget("_new"), true);
assert.equal(shouldTrapWindowTarget("_self"), false);
assert.equal(shouldTrapWindowTarget("octop-oauth"), false);

assert.equal(
  resolveOpenUrl("/privacy-policy", "http://127.0.0.1:3780/login"),
  "http://127.0.0.1:3780/privacy-policy",
);
assert.equal(
  resolveOpenUrl(
    "https://github.com/XYAIStudio/openXYOS",
    "http://127.0.0.1:3780/",
  ),
  "https://github.com/XYAIStudio/openXYOS",
);
assert.equal(resolveOpenUrl("javascript:alert(1)", "http://127.0.0.1:3780/"), null);
assert.equal(resolveOpenUrl("", "http://127.0.0.1:3780/"), null);

const top = {} as Window;
const framed = { self: {} as Window, top } as Window;
(framed as { self: Window }).self = framed;
assert.equal(isEmbeddedFrame(framed), true);
assert.equal(isEmbeddedFrame({ self: top, top } as Window), false);

console.log("test-embed-trap: ok");
