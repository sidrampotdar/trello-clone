/* Next-Gen Kanban Service Worker — minimal shell cache + offline mutation queue. */

const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const SHELL = ["/", "/boards", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL).catch(() => {
        /* ignore — best effort */
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") {
    event.respondWith(
      fetch(req).catch(async () => {
        const body = await req.clone().text();
        await queueMutation({ url: req.url, method: req.method, headers: [...req.headers], body });
        return new Response(JSON.stringify({ queued: true }), {
          status: 202,
          headers: { "Content-Type": "application/json" },
        });
      })
    );
    return;
  }
  const url = new URL(req.url);
  if (url.pathname.startsWith("/_next/") || url.pathname === "/" || url.pathname.startsWith("/board")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((m) => m ?? new Response("offline", { status: 503 })))
    );
  }
});

const QUEUE_DB = "kanban-mutations";

async function queueMutation(entry) {
  const db = await openDb();
  const tx = db.transaction("queue", "readwrite");
  tx.objectStore("queue").add({ ...entry, ts: Date.now() });
  return new Promise((resolve) => {
    tx.oncomplete = () => resolve();
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore("queue", { keyPath: "ts" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

self.addEventListener("sync", (event) => {
  if (event.tag === "flush-mutations") {
    event.waitUntil(flushQueue());
  }
});

async function flushQueue() {
  const db = await openDb();
  const tx = db.transaction("queue", "readwrite");
  const store = tx.objectStore("queue");
  const all = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
  });
  for (const entry of all) {
    try {
      await fetch(entry.url, { method: entry.method, headers: new Headers(entry.headers), body: entry.body });
      store.delete(entry.ts);
    } catch {
      /* keep queued */
    }
  }
}
