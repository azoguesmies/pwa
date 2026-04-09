/* ══════════════════════════════════════════════════════════════
   NEXUS PWA v4 — sw.js
   Service Worker con estrategia de auto-actualización:

   1. INSTALL   → descarga todos los assets al cache
   2. ACTIVATE  → elimina caches antiguos e intercepta todos los clientes
   3. FETCH     → Network-first para HTML/JS/CSS (siempre busca actualizaciones)
                  Cache-first para imágenes y fuentes
   4. MESSAGE   → escucha SKIP_WAITING del cliente para activación inmediata

   Cuando hay una nueva versión:
   - El SW nuevo se instala en segundo plano
   - app.js detecta 'updatefound' y muestra el banner "Actualizar ahora"
   - Al pulsar el botón, se envía SKIP_WAITING → el SW toma control
   - 'controllerchange' dispara window.location.reload() → página actualizada
   ══════════════════════════════════════════════════════════════ */

// ── Incrementar CACHE_VERSION cada vez que se despliega una nueva versión
const CACHE_VERSION = 'nexus-v4';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;

// Assets que se cachean en la instalación
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
];

/* ── INSTALL ─────────────────────────────────────────────────────
   Pre-cachea todos los assets estáticos.
   waitUntil garantiza que el SW no se activa hasta que todo esté cacheado.
   ─────────────────────────────────────────────────────────────── */
self.addEventListener('install', event => {
  console.log('[SW] Installing version:', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => {
        console.log('[SW] Assets cacheados correctamente');
        // NO llamar skipWaiting() aquí — se espera confirmación del usuario
        // a través del mensaje SKIP_WAITING desde app.js
      })
      .catch(err => console.error('[SW] Error cacheando assets:', err))
  );
});

/* ── ACTIVATE ────────────────────────────────────────────────────
   Elimina todos los caches que no correspondan a la versión actual.
   clients.claim() hace que el nuevo SW tome control de todas las
   pestañas abiertas sin necesidad de recargar manualmente.
   ─────────────────────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  console.log('[SW] Activating version:', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_STATIC)
          .map(key => {
            console.log('[SW] Eliminando cache antiguo:', key);
            return caches.delete(key);
          })
      );
    }).then(() => {
      console.log('[SW] Cache limpiado. Tomando control de todos los clientes.');
      return self.clients.claim();
    })
  );
});

/* ── FETCH ───────────────────────────────────────────────────────
   Estrategia diferenciada por tipo de recurso:

   • HTML / JS / CSS → Network-first:
     Intenta red primero. Si falla (offline), sirve desde cache.
     Garantiza que siempre se sirva la versión más reciente cuando hay conexión.

   • Imágenes / Fuentes → Cache-first:
     Sirve desde cache primero. Si no está, busca en red y lo cachea.
     Optimiza rendimiento para recursos que cambian poco.

   • Google Fonts / CDN externos → Network-first sin fallback de error
   ─────────────────────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Ignorar peticiones no HTTP y chrome-extension
  if (!event.request.url.startsWith('http')) return;

  // Ignorar peticiones al Google Apps Script (no cachear datos dinámicos)
  if (url.hostname.includes('script.google.com')) return;

  const isHTML   = event.request.headers.get('accept')?.includes('text/html');
  const isAsset  = /\.(js|css)(\?|$)/.test(url.pathname);
  const isImage  = /\.(png|jpg|jpeg|svg|ico|webp)(\?|$)/.test(url.pathname);
  const isFont   = url.hostname.includes('fonts.g') || /\.(woff2?|ttf|eot)/.test(url.pathname);

  if (isHTML || isAsset) {
    // Network-first: sirve siempre la versión más reciente si hay red
    event.respondWith(networkFirst(event.request));
  } else if (isImage || isFont) {
    // Cache-first: optimiza rendimiento para recursos estáticos
    event.respondWith(cacheFirst(event.request));
  } else {
    // Default: network-first para el resto
    event.respondWith(networkFirst(event.request));
  }
});

/* ── ESTRATEGIA: NETWORK-FIRST ───────────────────────────────── */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    // Cachear respuesta válida
    if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    // Offline: servir desde cache
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback final para navegación
    if (request.headers.get('accept')?.includes('text/html')) {
      return caches.match('./index.html');
    }
    return new Response('Sin conexión', { status: 503 });
  }
}

/* ── ESTRATEGIA: CACHE-FIRST ─────────────────────────────────── */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (err) {
    return new Response('Recurso no disponible', { status: 503 });
  }
}

/* ── MESSAGE: SKIP_WAITING ───────────────────────────────────────
   Recibe el mensaje desde app.js cuando el usuario pulsa "Actualizar ahora".
   skipWaiting() activa el nuevo SW inmediatamente.
   El evento 'controllerchange' en app.js dispara el reload de la página.
   ─────────────────────────────────────────────────────────────── */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] SKIP_WAITING recibido — activando nueva versión');
    self.skipWaiting();
  }
});
