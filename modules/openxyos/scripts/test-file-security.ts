import assert from "node:assert/strict";
import net from "node:net";
import { AddressInfo } from "node:net";

async function withMockClamAv(response: string, checkProtocol: boolean, run: (port: number) => Promise<void>) {
  const server = net.createServer((socket) => {
    let received = Buffer.alloc(0);
    socket.on("data", (chunk) => {
      received = Buffer.concat([received, chunk]);
      // A zero-length INSTREAM chunk terminates the request.
      if (received.length >= 4 && received.subarray(-4).equals(Buffer.alloc(4))) {
        if (checkProtocol) assert.ok(received.subarray(0, 10).equals(Buffer.from("zINSTREAM\0")), "must use ClamAV zINSTREAM protocol");
        socket.end(response);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as AddressInfo;
    await run(address.port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function main() {
  process.env.NODE_ENV = "development";
  process.env.FILE_SCAN_MODE = "required";
  const { scanFileBuffer } = await import("../backend/services/file-security");

  await withMockClamAv("stream: OK\0", true, async (port) => {
    process.env.CLAMAV_HOST = "127.0.0.1";
    process.env.CLAMAV_PORT = String(port);
    assert.deepEqual(await scanFileBuffer(Buffer.from("safe")), { verdict: "clean", engine: "clamav" });
  });
  await withMockClamAv("stream: Eicar-Test-Signature FOUND\0", false, async (port) => {
    process.env.CLAMAV_HOST = "127.0.0.1";
    process.env.CLAMAV_PORT = String(port);
    assert.deepEqual(await scanFileBuffer(Buffer.from("infected")), { verdict: "blocked", reason: "infected" });
  });
  await withMockClamAv("stream: unknown response\0", false, async (port) => {
    process.env.CLAMAV_HOST = "127.0.0.1";
    process.env.CLAMAV_PORT = String(port);
    assert.deepEqual(await scanFileBuffer(Buffer.from("invalid")), { verdict: "blocked", reason: "invalid_response" });
  });

  process.env.NODE_ENV = "production";
  process.env.FILE_SCAN_MODE = "disabled";
  delete process.env.CLAMAV_HOST;
  delete process.env.CLAMAV_PORT;
  assert.deepEqual(await scanFileBuffer(Buffer.from("must fail closed")), { verdict: "blocked", reason: "unavailable" });
  console.log("file-security tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
