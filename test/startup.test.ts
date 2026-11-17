import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const root = fileURLToPath(new URL("..", import.meta.url));
const LISTEN_BUDGET_MS = 5_000;

async function freePort() {
  const s = createServer();
  await new Promise<void>(r => s.listen(0, "127.0.0.1", r));
  const p = (s.address() as any).port;
  await new Promise<void>(r => s.close(() => r()));
  return p as number;
}

async function stop(child: ChildProcess) {
  if (child.exitCode !== null || child.pid == null) return;
  const done = new Promise<void>(r => child.once("exit", () => r()));
  try { process.kill(-child.pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  const killer = setTimeout(() => {
    try { process.kill(-child.pid!, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* already gone */ } }
  }, 2000);
  await done;
  clearTimeout(killer);
}

test("production start listens within 5s after a server build", { timeout: 30_000 }, async () => {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.match(String(pkg.scripts.start), /node dist\/server\.js/, "start must use the precompiled server, not tsx");
  const built = spawnSync(process.execPath, ["scripts/build-server.mjs"], { cwd: root, encoding: "utf8" });
  assert.equal(built.status, 0, built.stderr || built.stdout);

  const dir = await mkdtemp(join(tmpdir(), "tripfill-startup-"));
  const port = await freePort();
  const env = {
    ...process.env,
    NODE_ENV: "production",
    PORT: String(port),
    HOST: "127.0.0.1",
    TRIPFILL_DISABLE_AI: "1",
    TRIPFILL_CACHE_DIR: join(dir, "cache"),
    TRIPFILL_SHARE_DIR: join(dir, "shares"),
  };
  // Spawn the same node entry Render uses (`npm start` → node dist/server.js) in its own
  // process group so teardown cannot leave a detached server the way SIGTERM on npm can.
  const child = spawn(process.execPath, ["dist/server.js"], {
    cwd: root,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const t0 = Date.now();
  let output = "";
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`server did not listen within ${LISTEN_BUDGET_MS}ms\n${output}`)), LISTEN_BUDGET_MS);
      const onData = (c: Buffer | string) => {
        output += String(c);
        if (output.includes("TripFill listening")) {
          clearTimeout(timeout);
          resolve();
        }
      };
      child.stdout.on("data", onData);
      child.stderr.on("data", onData);
      child.on("exit", code => {
        clearTimeout(timeout);
        reject(new Error(`server exited ${code} before listen\n${output}`));
      });
    });
    const elapsed = Date.now() - t0;
    assert.ok(elapsed <= LISTEN_BUDGET_MS, `listened in ${elapsed}ms, budget ${LISTEN_BUDGET_MS}ms`);
    const health = await (await fetch(`http://127.0.0.1:${port}/healthz`)).json() as { ok: boolean; version: string };
    assert.equal(health.ok, true);
    assert.equal(health.version, pkg.version);
  } finally {
    await stop(child);
    await rm(dir, { recursive: true, force: true });
  }
});
