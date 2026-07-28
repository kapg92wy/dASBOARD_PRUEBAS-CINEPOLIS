/* ═══════════════════════════════════════════════
   auth.js — Autenticación
   Valida contra Supabase, guarda sesión en
   sessionStorage (se limpia al cerrar pestaña).
   ═══════════════════════════════════════════════ */

let currentUser = null;

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim().toLowerCase();
  const password = document.getElementById('loginPass').value;
  const errEl    = document.getElementById('loginErr');
  const btn      = document.getElementById('loginBtn');

  errEl.textContent = '';
  if (!username || !password) { errEl.textContent = 'Ingresa usuario y contraseña'; return; }

  btn.disabled = true;
  btn.innerHTML = '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>';

  try {
    const usuario = await DB.loginUsuario(username, password);
    if (!usuario) { errEl.textContent = 'Usuario o contraseña incorrectos'; return; }

    currentUser = { ...usuario };
    sessionStorage.setItem('cp_session', JSON.stringify(currentUser));
    await initApp();

  } catch (err) {
    errEl.textContent = 'Error de conexión. Verifica tu internet e intenta de nuevo.';
    console.error('[auth] login error:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = 'INGRESAR';
  }
}

function doLogout() {
  currentUser = null;
  sessionStorage.removeItem('cp_session');

  // Destruir gráficas
  Object.values(charts).forEach(c => { try { c.destroy(); } catch(e){} });
  Object.keys(charts).forEach(k => delete charts[k]);

  // Cancelar Realtime
  if (window._rtChannel) { DB.desuscribir(window._rtChannel); window._rtChannel = null; }

  document.getElementById('app').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginErr').textContent = '';
}

async function checkSession() {
  try {
    const s = sessionStorage.getItem('cp_session');
    if (s) { currentUser = JSON.parse(s); await initApp(); }
  } catch(e) { sessionStorage.removeItem('cp_session'); }
}

function requireRole(...roles) {
  if (!currentUser || !roles.includes(currentUser.rol)) {
    showToast('No tienes permiso para esta acción', 'error');
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════
   CAMBIO DE CONTRASEÑA (cualquier usuario)
   ═══════════════════════════════════════════════ */
function openPassModal() {
  if (!currentUser) return;
  document.getElementById('passModalContent').innerHTML = `
    <div style="font-size:12px;color:var(--text2);margin-bottom:16px;">
      Usuario: <strong style="color:var(--gold);">${currentUser.username}</strong>
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label class="form-label">Contraseña actual</label>
      <input class="form-input" id="pOld" type="password" placeholder="••••••••" autocomplete="current-password">
    </div>
    <div class="form-group" style="margin-bottom:14px;">
      <label class="form-label">Nueva contraseña</label>
      <input class="form-input" id="pNew" type="password" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
    </div>
    <div class="form-group" style="margin-bottom:18px;">
      <label class="form-label">Repite la nueva contraseña</label>
      <input class="form-input" id="pNew2" type="password" placeholder="••••••••" autocomplete="new-password">
    </div>
    <div style="display:flex;gap:10px;">
      <button class="btn-primary" id="savePassBtn" onclick="savePassword()">Guardar</button>
      <button class="btn-ghost" onclick="closePassModal()">Cancelar</button>
    </div>
    <div style="color:var(--red);font-size:12px;margin-top:10px;" id="passErr"></div>`;
  document.getElementById('modalPassBg').classList.add('open');
  setTimeout(() => { const el = document.getElementById('pOld'); if (el) el.focus(); }, 60);
}

function closePassModal(e) {
  if (e && e.target !== document.getElementById('modalPassBg')) return;
  document.getElementById('modalPassBg').classList.remove('open');
}

async function savePassword() {
  const oldP = document.getElementById('pOld').value;
  const newP = document.getElementById('pNew').value;
  const rep  = document.getElementById('pNew2').value;
  const err  = document.getElementById('passErr');
  const btn  = document.getElementById('savePassBtn');
  err.textContent = '';

  if (!oldP || !newP || !rep)      { err.textContent = 'Llena todos los campos'; return; }
  if (oldP !== currentUser.password){ err.textContent = 'Tu contraseña actual no es correcta'; return; }
  if (newP.length < 6)             { err.textContent = 'La nueva contraseña debe tener al menos 6 caracteres'; return; }
  if (newP !== rep)                { err.textContent = 'Las contraseñas nuevas no coinciden'; return; }
  if (newP === oldP)               { err.textContent = 'La nueva contraseña debe ser distinta a la actual'; return; }

  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    await DB.actualizarUsuario(currentUser.id, { password: newP });
    // Refrescar la sesión en memoria y en el navegador
    currentUser.password = newP;
    sessionStorage.setItem('cp_session', JSON.stringify(currentUser));
    closePassModal();
    showToast('Contraseña actualizada ✓', 'success');
  } catch (e) {
    err.textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}
