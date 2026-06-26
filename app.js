/* ═══════════════════════════════════════════════
   app.js — Router principal e inicialización
   ═══════════════════════════════════════════════ */

window._rtChannel   = null;
window._autoRefresh = null;   // intervalo de auto-refresh del dashboard
let currentTab      = null;   // tab activo en este momento

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

/* ── Inicializar app tras login ─────────────────── */
async function initApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  const rolMap   = { cinepolis:'cine', mantenimiento:'mant', tecnico:'mant', admin:'admin', ejecutivo:'exec' };
  const rolLabel = { cinepolis:'CINÉPOLIS', mantenimiento:'MANTENIMIENTO', tecnico:'TÉCNICO', admin:'ADMINISTRADOR', ejecutivo:'EJECUTIVO' };
  const badge = document.getElementById('roleBadge');
  badge.textContent = rolLabel[currentUser.rol] || currentUser.rol.toUpperCase();
  badge.className   = 'hbadge ' + (rolMap[currentUser.rol] || 'bw');
  document.getElementById('userLabel').textContent = currentUser.nombre;

  if (['admin','mantenimiento','ejecutivo'].includes(currentUser.rol)) {
    document.getElementById('liveBadge').style.display = 'flex';
    document.getElementById('fechaBadge').style.display = 'block';
    document.getElementById('headerTitle').textContent = 'CENTRO DE SERVICIO GALEX';
    document.getElementById('headerSub').textContent   = 'Gestión de máquinas · Cinépolis';
    await cargarDashboardSnapshot();
    const fb = document.getElementById('fechaBadge');
    if (fb) fb.textContent = D.fecha_actualizacion || '—';

    // ── Auto-refresh cada 30 min ──────────────────
    window._autoRefresh = setInterval(async () => {
      const antes = D.fecha_actualizacion;
      await cargarDashboardSnapshot();
      // Solo re-renderiza si el snapshot cambió y es un tab de dashboard
      const tabsDashboard = ['dashboard','dashboard_resumen','dashboard_incidencias','dashboard_prioridad','dashboard_venta'];
      if (D.fecha_actualizacion !== antes && tabsDashboard.includes(currentTab)) {
        renderTab(currentTab);
        showToast('Dashboard actualizado automáticamente ✓', 'info');
      }
    }, REFRESH_INTERVAL_MS);
  }

  buildNav();

  const firstTab = currentUser.rol === 'cinepolis'
    ? 'inicio'
    : currentUser.rol === 'tecnico'
      ? 'mis_asignadas'
      : currentUser.rol === 'mantenimiento'
        ? 'incidencias_cines'
        : 'dashboard';
  renderTab(firstTab);

  if (currentUser.rol !== 'cinepolis') {
    window._rtChannel = DB.suscribirIncidencias((payload) => {
      updateBadge();
      const tbC = document.getElementById('tbCinesLista');
      if (tbC) {
        DB.getIncidencias().then(data => {
          _todasIncs = data;
          filtrarCines();
        }).catch(()=>{});
      }
      const tbA = document.getElementById('tbMisAsignadas');
      if (tbA && typeof recargarMisAsignadas === 'function') recargarMisAsignadas();
    });
  }

  setupEventListeners();
}

/* ── Construir navegación ────────────────────────── */
function buildNav() {
  const rol = currentUser.rol;
  let tabs = [];

  if (rol === 'cinepolis') {
    tabs = [
      { id:'inicio', label:'🏠 Mi Panel' },
      { id:'nueva',  label:'➕ Reportar Incidencia' },
      { id:'lista',  label:'📋 Mis Incidencias', badge:true },
    ];
  } else if (rol === 'tecnico') {
    tabs = [
      { id:'mis_asignadas', label:'🔧 Mis Asignadas', badge:true },
    ];
  } else if (rol === 'mantenimiento') {
    tabs = [
      { id:'incidencias_cines',    label:'📩 Incidencias Reportadas', badge:true },
      { id:'dashboard_resumen',    label:'📊 Resumen General' },
      { id:'dashboard_incidencias',label:'🔧 Incidencias BD' },
      { id:'dashboard_prioridad',  label:'⚡ Por Prioridad' },
      { id:'dashboard_venta',      label:'📈 Alerta Venta' },
    ];
  } else if (rol === 'ejecutivo') {
    tabs = [
      { id:'dashboard',            label:'📊 Resumen General' },
      { id:'incidencias_cines',    label:'📩 Incidencias Cines', badge:true },
      { id:'dashboard_incidencias',label:'🔧 Incidencias BD' },
      { id:'dashboard_prioridad',  label:'⚡ Por Prioridad' },
      { id:'dashboard_venta',      label:'📈 Alerta Venta' },
    ];
  } else { // admin
    tabs = [
      { id:'dashboard',            label:'📊 Resumen General' },
      { id:'incidencias_cines',    label:'📩 Incidencias Cines', badge:true },
      { id:'dashboard_incidencias',label:'🔧 Incidencias BD' },
      { id:'dashboard_prioridad',  label:'⚡ Por Prioridad' },
      { id:'dashboard_venta',      label:'📈 Alerta Venta' },
      { id:'usuarios',             label:'👥 Usuarios' },
    ];
  }

  const nav = document.getElementById('mainNav');
  nav.innerHTML = tabs.map(t =>
    `<div class="ntab" data-tab="${t.id}">${t.label}${t.badge ? '<span class="nbadge" id="nbTotal">0</span>' : ''}</div>`
  ).join('');

  nav.querySelectorAll('.ntab').forEach(t => {
    t.addEventListener('click', function() {
      nav.querySelectorAll('.ntab').forEach(x => x.classList.remove('active'));
      this.classList.add('active');
      renderTab(this.dataset.tab);
    });
  });

  nav.querySelector('.ntab').classList.add('active');
  updateBadge();
}

/* ── Router de tabs ──────────────────────────────── */
function renderTab(tab) {
  currentTab = tab;
  const mc = document.getElementById('mainContent');

  Object.values(charts).forEach(c => { try { c.destroy(); } catch(e){} });
  Object.keys(charts).forEach(k => delete charts[k]);

  mc.innerHTML = `<div id="tab-${tab}" class="tab active"></div>`;
  const div = document.getElementById('tab-' + tab);

  switch(tab) {
    case 'inicio':               renderInicio(div);               break;
    case 'nueva':                renderNueva(div);                break;
    case 'lista':                renderLista(div);                break;
    case 'mis_asignadas':        renderMisAsignadas(div);         break;
    case 'usuarios':             renderUsuarios(div);             break;
    case 'log':                  renderLog(div);                  break;
    case 'incidencias_cines':    renderIncidenciasCines(div);     break;
    case 'dashboard':
    case 'dashboard_resumen':    renderDashboard(div);            break;
    case 'dashboard_incidencias':renderDashboardIncidencias(div); break;
    case 'dashboard_prioridad':  renderDashboardPrioridad(div);   break;
    case 'dashboard_venta':      renderDashboardVenta(div);       break;
    default: div.innerHTML = `<div class="nodata">Tab "${tab}" no encontrado</div>`;
  }

  document.getElementById('mainNav').querySelectorAll('.ntab').forEach(t => {
    if (t.dataset.tab === tab) t.classList.add('active');
    else t.classList.remove('active');
  });
}

/* ── Event listeners globales ────────────────────── */
function setupEventListeners() {
  document.getElementById('loginPass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  document.getElementById('loginUser').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  document.getElementById('loginBtn').onclick  = doLogin;
  document.getElementById('logoutBtn').onclick = doLogout;
  document.getElementById('modalBg').addEventListener('click', closeModal);
  document.getElementById('modalCloseBtn').addEventListener('click', () => closeModal());
  document.getElementById('modalUserBg').addEventListener('click', closeUserModal);
  document.getElementById('userModalCloseBtn').addEventListener('click', () => closeUserModal());
}

/* ── Arrancar ─────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginPass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  document.getElementById('loginUser').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });
  document.getElementById('loginBtn').onclick = doLogin;
  checkSession();
});
