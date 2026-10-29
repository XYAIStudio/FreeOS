import assert from "node:assert/strict";
import { resolveListenHost } from "../backend/listen-host";

assert.equal(resolveListenHost({}), "127.0.0.1");
assert.equal(resolveListenHost({ HOST: "0.0.0.0" }), "127.0.0.1");
assert.equal(resolveListenHost({ FREEOS_ORG_BIND_HOST: "0.0.0.0" }), "0.0.0.0");
assert.equal(resolveListenHost({ FREEOS_ORG_BIND_HOST: "  " }), "127.0.0.1");
console.log("listen host ok");
