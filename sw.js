/* ═══════════════════════════════════════════════
   sw.js — Service Worker
   - Network-first para el código (se actualiza solo
     al subir cambios a Vercel; respaldo offline).
   - Recibe notificaciones push y las muestra.
   NO toca Supabase (otro dominio) — datos siempre
   frescos desde la red.
   ═══════════════════════════════════════════════ */

const CACHE = 'centro-servicio-v3';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './config.js',
  './supabase.js',
  './ui.js',
  './auth.js',
  './incidencias.js',
  './dashboard.js',
  './actualizador.js',
  './push.js',
  './app.js',
  './usuarios.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});

/* ── PUSH: recibir y mostrar la notificación ─────── */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; }
  catch { d = { title: 'Centro de Servicio', body: e.data ? e.data.text() : '' }; }

  e.waitUntil(
    self.registration.showNotification(d.title || 'Centro de Servicio', {
      body:     d.body || 'Tienes una incidencia asignada',
      icon:     'icon-192.png',
      badge:    'icon-192.png',
      tag:      d.tag || 'asignacion',
      renotify: true,
      data:     d,
    })
  );
});

/* ── Al tocar la notificación: abrir/enfocar la app ─ */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
