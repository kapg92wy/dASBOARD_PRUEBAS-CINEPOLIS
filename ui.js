/* ═══════════════════════════════════════════════
   ui.js — Helpers de interfaz reutilizables
   ═══════════════════════════════════════════════ */

// ── IDs y timestamps ─────────────────────────────
function nowISO() { return new Date().toISOString(); }
function newId(prefix) {
  return (prefix || 'id') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2,6);
}

// ── Formatear fecha ISO a español ────────────────
function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' })
       + ' ' + d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
}

// ── Badges ───────────────────────────────────────
function prioBadge(p) {
  return p === 'Urgente'
    ? '<span class="badge br">🔴 Urgente</span>'
    : '<span class="badge bw">Normal</span>';
}
// ── Etapas del flujo SLA ─────────────────────────
// Día 1 → 4 → 10 → 14 → cierre (según tabla de negocio)
const SLA_ETAPAS = [
  { key: 'Abierta',          label: 'Ticket recibido',  dias: 1  },
  { key: 'En diagnóstico',   label: 'En diagnóstico',   dias: 4  },
  { key: 'En logística',     label: 'Logística',        dias: 10 },
  { key: 'Atención técnico', label: 'Atención técnico', dias: 14 },
  { key: 'Resuelta',         label: 'Finalizado',       dias: null },
];

function estadoToEtapa(estado) {
  const idx = SLA_ETAPAS.findIndex(e => e.key === estado);
  if (idx >= 0) return idx;
  if (estado === 'Cerrada')    return 4;
  if (estado === 'En proceso') return 1;   // compat. registros viejos
  return 0;
}

function estadoBadge(e) {
  const m = {
    'Abierta':          '<span class="badge br">Ticket recibido</span>',
    'En diagnóstico':   '<span class="badge bo">En diagnóstico</span>',
    'En logística':     '<span class="badge bp">Logística</span>',
    'Atención técnico': '<span class="badge bc">Atención técnico</span>',
    'Resuelta':         '<span class="badge bg">Finalizado</span>',
    'Cerrada':          '<span class="badge bg">✅ Cerrado</span>',
    'En proceso':       '<span class="badge bo">En diagnóstico</span>',  // compat
  };
  return m[e] || `<span class="badge bw">${e || '—'}</span>`;
}

// Badge de tipo de resolución (Reparación / Retiro)
function resolucionBadge(tipo) {
  if (!tipo) return '';
  if (tipo === 'Retiro')     return '<span class="badge br" style="font-size:11px;">🔄 Retiro</span>';
  if (tipo === 'Reparación') return '<span class="badge bg" style="font-size:11px;">🔧 Reparación</span>';
  return `<span class="badge bw" style="font-size:11px;">${tipo}</span>`;
}

// ── Barra de progreso SLA ─────────────────────────
// showDias = true solo para mantenimiento/admin/técnico (el cine no ve los días)
function slaProgressBar(estado, tipo_resolucion, showDias) {
  const etapaActual = estadoToEtapa(estado);
  const cerrada     = estado === 'Cerrada';

  const steps = SLA_ETAPAS.map((e, i) => {
    const done   = cerrada || i < etapaActual;
    const active = !cerrada && i === etapaActual;

    const dotBg     = done ? 'var(--green)' : active ? 'var(--gold)' : 'var(--panel3)';
    const dotBorder = done ? 'var(--green)' : active ? 'var(--gold)' : 'var(--border2)';
    const lineColor = (cerrada || i < etapaActual) ? 'var(--green)' : 'var(--border2)';
    const lblColor  = done ? 'var(--green)' : active ? 'var(--gold)' : 'var(--text3)';
    const lblWeight = active ? '700' : '400';
    const dotTxt    = (done || active) ? '#060a12' : 'var(--text3)';
    const check     = done ? '✓' : (i + 1);

    const linea = (i < SLA_ETAPAS.length - 1)
      ? `<div style="position:absolute;top:11px;left:50%;width:100%;height:2px;background:${lineColor};z-index:0;"></div>`
      : '';
    const dias = (showDias && e.dias != null)
      ? `<div style="font-size:9px;color:var(--text3);margin-top:2px;">SLA ${e.dias}d</div>`
      : '';

    return `
      <div style="display:flex;flex-direction:column;align-items:center;flex:1;position:relative;min-width:0;">
        ${linea}
        <div style="width:22px;height:22px;border-radius:50%;background:${dotBg};border:2px solid ${dotBorder};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${dotTxt};z-index:1;">${check}</div>
        <div style="font-size:9px;color:${lblColor};font-weight:${lblWeight};margin-top:5px;text-align:center;line-height:1.2;">${e.label}</div>
        ${dias}
      </div>`;
  }).join('');

  const badge = resolucionBadge(tipo_resolucion);
  return `
    <div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:14px 12px 12px;">
      <div style="display:flex;align-items:flex-start;">${steps}</div>
      ${badge ? `<div style="text-align:center;margin-top:10px;">${badge}</div>` : ''}
    </div>`;
}

// ── KPI card HTML ─────────────────────────────────
function kcard(color, label, val, sub) {
  return `<div class="kcard ${color}">
    <div class="klabel">${label}</div>
    <div class="kval">${val}</div>
    ${sub ? `<div class="ksub">${sub}</div>` : ''}
  </div>`;
}

// ── Error box HTML ────────────────────────────────
function errorBox(msg) {
  return `<div style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.3);border-radius:8px;padding:16px;color:var(--red);font-size:13px;">❌ ${msg}</div>`;
}

// ── Loading spinner HTML ──────────────────────────
function loadingHTML(msg) {
  return `<div class="loading-wrap"><div class="spinner"></div><div style="font-size:12px;color:var(--text2);">${msg || 'Cargando...'}</div></div>`;
}

// Spinner DENTRO de una tabla (fila válida, para que no se quede huérfano)
function loadingRow(cols, msg) {
  return `<tr><td colspan="${cols || 1}" style="padding:0;border:none;background:transparent;">${loadingHTML(msg)}</td></tr>`;
}

// ── Toast notifications ───────────────────────────
function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Paginación ───────────────────────────────────
function renderPag(containerId, total, currentPage, onPageChange) {
  const c = document.getElementById(containerId);
  if (!c) return;
  const PS = CONFIG.PAGE_SIZE;
  const totalPages = Math.ceil(total / PS);
  if (totalPages <= 1) {
    c.innerHTML = `<span class="pinfo">${total} registros</span>`;
    return;
  }
  let h = `<span class="pinfo">${total} registros · Pág ${currentPage}/${totalPages}</span>`;
  if (currentPage > 1)
    h += `<button class="pbtn" onclick="(${onPageChange})(${currentPage - 1})">‹</button>`;
  const start = Math.max(1, currentPage - 2), end = Math.min(totalPages, currentPage + 2);
  for (let p = start; p <= end; p++)
    h += `<button class="pbtn ${p === currentPage ? 'active' : ''}" onclick="(${onPageChange})(${p})">${p}</button>`;
  if (currentPage < totalPages)
    h += `<button class="pbtn" onclick="(${onPageChange})(${currentPage + 1})">›</button>`;
  c.innerHTML = h;
}

// ── Badge de conteo en nav ─────────────────────────
async function updateBadge() {
  const nb = document.getElementById('nbTotal');
  if (!nb || !currentUser) return;
  try {
    const filtros = currentUser.rol === 'cinepolis' ? { usuario_id: currentUser.id } : {};
    const incs = await DB.getIncidencias(filtros);
    let lista = incs.filter(r => r.estado !== 'Resuelta' && r.estado !== 'Cerrada');
    if (currentUser.rol === 'tecnico') lista = lista.filter(r => r.tecnico_id === currentUser.id);
    nb.textContent = lista.length;
  } catch(e) { /* silencioso */ }
}
