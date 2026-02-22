const STATIC_CACHE = "upsc-static-v1";
const RUNTIME_CACHE = "upsc-runtime-v1";

const APP_SHELL = [
  "./",
  "./index.html",
  "./prelims.html",
  "./mains.html",
  "./combined.html",
  "./post-view.html",
  "./admin-login.html",
  "./admin-dashboard.html",
  "./edit-post.html",
  "./offline.html",
  "./manifest.webmanifest",
  "./browserconfig.xml",
  "./css/style.css",
  "./css/admin.css",
  "./js/pwa.js",
  "./js/main.js",
  "./js/firebase-config.js",
  "./js/auth.js",
  "./js/quiz-app.js",
  "./js/post-view.js",
  "./js/admin.js",
  "./js/edit-post.js",
  "./assets/icons/icon-any.svg",
  "./assets/icons/icon-maskable.svg",
  "./assets/icons/favicon.svg",
  "./assets/icons/apple-touch-icon.svg",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css",
  "https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js",
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Merriweather:wght@400;700&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js",
  "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js",
  "https://code.jquery.com/jquery-3.6.0.min.js",
  "https://cdn.datatables.net/1.13.4/css/dataTables.bootstrap5.min.css",
  "https://cdn.datatables.net/1.13.4/js/jquery.dataTables.min.js",
  "https://cdn.datatables.net/1.13.4/js/dataTables.bootstrap5.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const requestUrl = new URL(request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  const isDocument = request.mode === "navigate";

  if (isDocument) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          return caches.match("./offline.html");
        })
    );
    return;
  }

  if (isSameOrigin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached || network;
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
