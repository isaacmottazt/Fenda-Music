// ============================================================
// Fenda Music — Service Worker v2
// ============================================================

const CACHE_NAME = 'fenda-music-v2';

// Arquivos locais que ficam em cache (shell do app)
const SHELL_ASSETS = [
  './',
  './index.html',
  './player.html',
  './reset-password.html',
  './base.css',
  './inicio.css',
  './busca.css',
  './biblioteca.css',
  './perfil.css',
  './login.css',
  './supabase-config.js',
  './search.js',
  './player-core.js',
  './player-ui.js',
  './player-audio-lyrics.js',
  './player-menus-core.js',
  './player-music-actions.js',
  './player-playlists.js',
  './fonts/material-symbols.css',
  './fonts/material-symbols-rounded.woff2',
];

// ── Instalação: pré-cacheia todo o shell ───────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Cacheando shell do app...');
      // Tenta cachear cada arquivo individualmente para não falhar tudo se um errar
      return Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Não cacheou:', url, err))
        )
      );
    })
  );
  self.skipWaiting();
});

// ── Ativação: remove caches antigos ───────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: estratégia por tipo de recurso ─────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase: dados e áudio → sempre rede, sem cache no SW
  // (os dados são gerenciados pelo CacheDB no app)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline: retorna resposta vazia para não travar
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Google Fonts CSS e woff2 → cache first, rede como fallback
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => cached); // offline: retorna cache mesmo expirado
        })
      )
    );
    return;
  }

  // jsDelivr (SDK Supabase) → cache first
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // Arquivos locais → cache first, rede como fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Cacheia dinamicamente qualquer arquivo local novo
        if (response.ok && url.origin === self.location.origin) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => {
        // Offline e sem cache: retorna player.html para qualquer página
        if (event.request.destination === 'document') {
          return caches.match('./player.html') || caches.match('./index.html');
        }
      });
    })
  );
});
