// TripFill service worker: offline app shell + last plan-related API responses.
// The plan itself lives in localStorage, so once the shell loads offline the last plan is there too.
// Map tiles (tile.openstreetmap.org) are deliberately NOT cached, per the OSM tile usage policy.
const VERSION = "tripfill-v1.8.2";
const SHELL = `${VERSION}-shell`, DATA = `${VERSION}-data`;
const CORE = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL);
    await c.addAll(CORE);
    // Precache the hashed JS/CSS bundles referenced by index.html
    const html = await (await c.match("/")).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
    await c.addAll(assets);
    // ...and the self-hosted latin font files referenced from the CSS bundle (so typography works offline too)
    for (const css of assets.filter(a => a.endsWith(".css"))) {
      const txt = await (await c.match(css)).text();
      const fonts = [...new Set([...txt.matchAll(/url\((\/assets\/[^)]+?latin-wght[^)]*?\.woff2)\)/g)].map(m => m[1]).filter(f => !/latin-ext/.test(f)))];
      await c.addAll(fonts);
    }
    self.skipWaiting();
  })());
});
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!k.startsWith(VERSION)) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (e) => {
  const req = e.request; const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // tiles, Wikipedia etc. go straight to network
  if (req.mode === "navigate") {
    // network-first for the page, falling back to the cached shell (works for ?share=… and #plan=… too)
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(SHELL).then(c => c.put("/", cp)); return r; }).catch(() => caches.match("/")));
    return;
  }
  if (url.pathname.startsWith("/api/fx") || url.pathname.startsWith("/api/share/")) {
    // network-first; keep the last good answer and serve it (flagged offline:true) when the network is down
    const key = url.pathname.startsWith("/api/fx") ? "/api/fx" : url.pathname;
    e.respondWith(fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(DATA).then(c => c.put(key, cp)); } return r; })
      .catch(async () => {
        const hit = await caches.match(key);
        const body = hit ? { ...(await hit.json()), offline: true } : { ok: false, rates: {}, source: "offline", offline: true, error: "offline and no cached copy" };
        return new Response(JSON.stringify(body), { status: hit || key === "/api/fx" ? 200 : 404, headers: { "Content-Type": "application/json" } });
      }));
    return;
  }
  if (url.pathname.startsWith("/api/")) return; // generate/geocode need the network
  // static assets: cache-first (hashed filenames), fill cache on miss
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => { if (r.ok) { const cp = r.clone(); caches.open(SHELL).then(c => c.put(req, cp)); } return r; })));
});
