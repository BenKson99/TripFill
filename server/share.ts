import { parsePlan } from "../shared/portable.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import type { Express } from "express";
import express from "express";

// Tiny share store: <dir>/<random id>.json. No accounts, no listing endpoint.
// Storage order: TRIPFILL_SHARE_DIR (or ./data/shares) → OS temp dir → in-memory map.
// Legacy compatibility only: the client no longer creates short links.
// On hosts with ephemeral disks (e.g. Render free) shares vanish on restart/redeploy; URL-embedded
// share links (#plan=…) are unaffected because they never touch the server.
const MAX_BYTES = 1_000_000;
const ID_RE = /^[A-Za-z0-9_-]{12}$/;
const MAX_MEM = 500;
const mem = new Map<string, string>();

function writableDir(): string | null {
  for (const d of [path.resolve(process.env.TRIPFILL_SHARE_DIR || "data/shares"), path.join(os.tmpdir(), "tripfill-shares")]) {
    try { fs.mkdirSync(d, { recursive: true }); fs.accessSync(d, fs.constants.W_OK); return d; } catch { /* try next */ }
  }
  return null;
}
let DIR: string | null | undefined;
export function shareStore() { if (DIR === undefined) { DIR = writableDir(); console.log(`Share store: ${DIR ?? "in-memory (no writable dir)"}`); } return DIR ?? "memory"; }

export function mountShare(app: Express) {
  shareStore();
  app.post("/api/share", express.json({ limit: MAX_BYTES }), (req, res) => {
    let plan: any;
    try { plan = parsePlan(JSON.stringify(req.body?.plan)); } catch (e: any) { return res.status(400).json({ error: e.message }); }
    if (!plan || typeof plan !== "object" || !plan.place || !plan.input) return res.status(400).json({ error: "Not a TripFill plan" });
    delete plan.packing.lastRemoved; // do not publish a local undo buffer
    const id = crypto.randomBytes(9).toString("base64url"); // 72 bits, unguessable
    const body = JSON.stringify({ createdAt: new Date().toISOString(), plan });
    if (DIR) {
      try { fs.writeFileSync(path.join(DIR, id + ".json"), body); return res.json({ id }); }
      catch (e) { console.warn("Share dir write failed, falling back to memory:", (e as Error).message); DIR = null; }
    }
    if (mem.size >= MAX_MEM) mem.delete(mem.keys().next().value!);
    mem.set(id, body); res.json({ id, ephemeral: true });
  });
  app.get("/api/share/:id", (req, res) => {
    if (!ID_RE.test(req.params.id)) return res.status(400).json({ error: "Bad id" });
    const m = mem.get(req.params.id); if (m) return res.type("json").send(m);
    try { if (DIR) return res.json(JSON.parse(fs.readFileSync(path.join(DIR, req.params.id + ".json"), "utf8"))); } catch { /* fall through */ }
    res.status(404).json({ error: "Shared plan not found (it may have been deleted from this server, or the server restarted). Lost short links cannot be recovered; ask the sender for a portable link or JSON export." });
  });
}
