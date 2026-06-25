/* ═══════════════════════════════════════════════
   push.js — Notificaciones push (Web Push)
   Pide permiso, suscribe el dispositivo y guarda
   la suscripción en Supabase (cp_push_subs).
   El botón "Activar notificaciones" del panel del
   técnico llama a window.activarNotificaciones().
   ═══════════════════════════════════════════════ */

// Llave pública VAPID (es pública, no es secreto).
const VAPID_PUBLIC_KEY = 'BE_h8jB4eFQas3GeRCqTDIWl6_f5xBGIcCPuouamAKFMY0auZCkyog1xsHsC2EYsn-zE5a8owyxtX6n7BkVFsr4';

function _urlB64ToUint8(base64) {
  const pad = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// ¿El dispositivo soporta push? (iPhone solo si la app está instalada)
function pushSoportado() {
  return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
}

async function _guardarSub(sub) {
  const j  = sub.toJSON ? sub.toJSON() : sub;
  // id estable por usuario + dispositivo (para no duplicar)
  const id = currentUser.id + '__' + btoa(j.endpoint).slice(-28);
  const { error } = await sb.from('cp_push_subs').upsert({
    id,
    usuario_id:   currentUser.id,
    username:     currentUser.username,
    subscription: j,
    created_at:   new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

// Llamar desde un botón (gesto del usuario — requisito de iOS)
window.activarNotificaciones = async function () {
  if (!pushSoportado()) {
    showToast('Tu dispositivo no soporta notificaciones. En iPhone, primero instala la app en la pantalla de inicio.', 'error');
    return false;
  }
  try {
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      showToast('No se activaron las notificaciones (permiso denegado).', 'error');
      return false;
    }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: _urlB64ToUint8(VAPID_PUBLIC_KEY),
      });
    }
    await _guardarSub(sub);
    showToast('🔔 Notificaciones activadas en este dispositivo', 'success');
    return true;
  } catch (err) {
    console.error('[push] error:', err);
    showToast('No se pudieron activar las notificaciones: ' + err.message, 'error');
    return false;
  }
};

// Saber si ya están activas en este dispositivo (para pintar el botón)
window.notificacionesActivas = async function () {
  if (!pushSoportado() || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    return !!(await reg.pushManager.getSubscription());
  } catch { return false; }
};
