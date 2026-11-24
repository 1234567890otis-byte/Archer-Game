// 離線快取（Service Worker）：載入過一次之後，沒有網路也能開遊戲
//   策略：有網路 → 一律抓最新版（同時更新快取）；沒網路 → 用快取
//   所以更新遊戲後，玩家只要有網路，下次開啟就是新版，不用手動清快取
//   只在 https 或 localhost 生效（瀏覽器規定）；區網的 http://192.168.x.x 不會啟用
const CACHE = "archer-of-god-v1";
const CORE = ["./", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(CACHE)
            .then((c) => Promise.all(CORE.map((u) => c.add(u).catch(() => {})))) // 某個檔案沒有也不影響
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// 頁面載入完會把用到的檔案清單傳過來（開發版有很多 js 檔），一起存起來
self.addEventListener("message", (e) => {
    const d = e.data || {};
    if (d.type !== "precache" || !Array.isArray(d.urls)) return;
    caches.open(CACHE).then((c) => d.urls.forEach((u) => {
        try {
            if (new URL(u).origin === self.location.origin) c.add(u).catch(() => {});
        } catch (err) {}
    }));
});

self.addEventListener("fetch", (e) => {
    const req = e.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith("/api/") || url.pathname === "/ws") return; // 主機存檔、連線對戰不快取
    e.respondWith(
        fetch(req)
            .then((res) => {
                if (res && res.ok) {
                    const copy = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
                }
                return res;
            })
            .catch(() => caches.match(req)
                .then((hit) => hit || (req.mode === "navigate" ? caches.match("./") : null))
                .then((hit) => hit || new Response("離線中，這個檔案還沒有快取", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })))
    );
});
