import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { makeShareLink, readSharedPlan } from "../src/Share.js";
import { fixture } from "./fixtures.js";

async function freePort() { const s = createServer(); await new Promise<void>(r => s.listen(0, "127.0.0.1", r)); const p = (s.address() as any).port; await new Promise<void>(r => s.close(() => r())); return p; }
async function stop(child: ChildProcess) { if (child.exitCode !== null) return; const done = new Promise<void>(r => child.once("exit", () => r())); child.kill("SIGTERM"); await done; }
test("production HTTP: dates, legacy links, portable snapshot across restart with EMPTY share store", { timeout: 30000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "tripfill-http-")); const port = await freePort(); const base = `http://127.0.0.1:${port}`;
  let child: ChildProcess | undefined;
  async function start(dir: string) {
    child = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], { env: { ...process.env, NODE_ENV: "production", PORT: String(port), HOST: "127.0.0.1", TRIPFILL_SHARE_DIR: join(root, dir), TRIPFILL_CACHE_DIR: join(root, "cache") }, stdio: ["ignore", "pipe", "pipe"] });
    let logs = ""; child.stdout?.on("data", b => { logs += b; }); child.stderr?.on("data", b => { logs += b; });
    for (let i = 0; i < 100; i++) { if (child.exitCode !== null) throw new Error(logs); try { const r = await fetch(`${base}/healthz`); if (r.ok) return; } catch {} await delay(50); }
    throw new Error("Production server did not start: " + logs);
  }
  try {
    await start("first");
    const health = await (await fetch(`${base}/healthz`)).json(); assert.equal(health.version, "1.13.0");
    for (const body of [{ start: "2026-02-30", end: "2026-03-02" }, { start: "2026-11-10", end: "2026-11-09" }, { start: "2000-01-01", end: "2000-01-02", today: "2026-11-06", tz: "America/Detroit" }]) {
      const r = await fetch(`${base}/api/generate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, destination: "Porto" }) }); assert.equal(r.status, 400); assert.ok((await r.json()).error);
    }
    const p = fixture(); p.input.dietaryNeeds = "vegetarian"; p.packing.groups[0].items[0].checked = true;
    const old = await fetch(`${base}/api/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: p }) }); assert.equal(old.status, 200); const { id } = await old.json();
    Object.defineProperty(globalThis, "location", { configurable: true, value: new URL(base) });
    const { url, mode } = await makeShareLink(p); assert.equal(mode, "url"); assert.match(url, /#plan=/);
    // No new share was stored for this portable URL. Legacy server record is only a control.
    const fetch0 = globalThis.fetch;
    globalThis.fetch = ((input: any, init: any) => fetch0(typeof input === "string" && input.startsWith("/") ? base + input : input, init)) as typeof fetch;
    try {
      Object.defineProperty(globalThis, "location", { configurable: true, value: new URL(`${base}?share=${id}`) });
      const legacy: any = await readSharedPlan(); assert.equal(legacy.via, "server");
      await stop(child!); await start("empty-after-restart");
      const missing: any = await readSharedPlan(); assert.match(missing.error, /cannot be recovered/);
      Object.defineProperty(globalThis, "location", { configurable: true, value: new URL(url) });
      assert.equal((await fetch(`${base}/healthz`)).status, 200);
      const portable: any = await readSharedPlan(); assert.equal(portable.via, "link"); assert.equal(portable.plan.packing.groups[0].items[0].checked, true); assert.equal(portable.plan.input.dietaryNeeds, "vegetarian");
      Object.defineProperty(globalThis, "location", { configurable: true, value: new URL(`${base}#plan=broken`) }); assert.ok("error" in (await readSharedPlan())!);
    } finally { globalThis.fetch = fetch0; delete (globalThis as any).location; }
  } finally { if (child) await stop(child); await rm(root, { recursive: true, force: true }); }
});
