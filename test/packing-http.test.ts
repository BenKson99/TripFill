import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { seedPackingQa } from "./packing-fixtures.js";

test("seeded production HTTP generates four climates/lengths and roundtrips packing without changing Plan/Budget", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tripfill-pack-http-")); await seedPackingQa(join(dir, "http-cache"));
  const socket = createServer(); await new Promise<void>(r => socket.listen(0, "127.0.0.1", r)); const port = (socket.address() as any).port; await new Promise<void>(r => socket.close(() => r()));
  const env = { ...process.env, NODE_ENV: "production", PORT: String(port), HOST: "127.0.0.1", TRIPFILL_DISABLE_AI: "1", TRIPFILL_CACHE_DIR: join(dir, "http-cache"), TRIPFILL_SHARE_DIR: join(dir, "shares") };
  const child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], { env, stdio: ["ignore", "pipe", "pipe"] });
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Fixture server startup timeout")), 10000);
      child.stdout.on("data", chunk => { if (String(chunk).includes("TripFill listening")) { clearTimeout(timeout); resolve(); } }); child.on("exit", code => { clearTimeout(timeout); reject(new Error(`Fixture server exited ${code}`)); });
    });
    const result = await new Promise<string>((resolve, reject) => {
      const qa = spawn(process.execPath, ["--import", "tsx", "scripts/packing-qa.ts", "verify", dir, `http://127.0.0.1:${port}`], { env, stdio: ["ignore", "pipe", "pipe"] }); let output = "";
      qa.stdout.on("data", c => output += c); qa.stderr.on("data", c => output += c); const timer = setTimeout(() => { qa.kill(); reject(new Error("HTTP fixture verification timed out")); }, 90000);
      qa.on("exit", code => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error(output)); });
    });
    assert.ok(result.includes("long-laundry")); const report = JSON.parse(await readFile(join(dir, "report.json"), "utf8")); assert.equal(report.report.length, 4); assert.ok(report.invalidPackingRejected); assert.ok(report.report.every((c: any) => c.generated === 200 && c.planBudgetUnchanged));
  } finally { const done = new Promise<void>(r => child.once("exit", () => r())); child.kill("SIGTERM"); await done; await rm(dir, { recursive: true, force: true }); }
});
