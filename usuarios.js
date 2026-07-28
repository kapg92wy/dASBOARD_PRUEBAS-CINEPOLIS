/* ═══════════════════════════════════════════════
   usuarios.js — Gestión de usuarios y log
   Solo accesible para rol admin
   ═══════════════════════════════════════════════ */

let editingUserId = null;

async function renderUsuarios(container) {
  container.innerHTML = loadingHTML('Cargando usuarios...');
  try {
    const users = await DB.getUsuarios();
    const rolBadge = {
      cinepolis:    '<span class="badge bc">Cinépolis</span>',
      mantenimiento:'<span class="badge bo">Mantenimiento</span>',
      tecnico:      '<span class="badge bb">Técnico</span>',
      ejecutivo:    '<span class="badge bc">Ejecutivo</span>',
      admin:        '<span class="badge bp">Admin</span>',
    };

    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">'
      + '<div><div style="font-family:var(--ff);font-size:18px;font-weight:700;">Gestión de Usuarios</div>'
      + '<div style="font-size:11px;color:var(--text2);margin-top:2px;">'+users.length+' usuarios activos · Supabase</div></div>'
      + '<button class="btn-primary" onclick="openUserModal()">+ Nuevo Usuario</button></div>'

      // Tarjetas BD
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px;">'
      + '<div class="icard" onclick="renderTab(\'log\')">'
      + '<div class="ititle"><div style="font-size:18px;">📋</div>Ver Log de Auditoría</div>'
      + '<div style="font-size:11px;color:var(--text2);">Historial de cambios guardado en Supabase.</div></div>'
      + '</div>'

      // Tabla usuarios
      + '<div class="twrap"><div class="tscroll"><table>'
      + '<thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Correo</th><th>Creado</th><th>Acciones</th></tr></thead>'
      + '<tbody>' + users.map(u => `
          <tr>
            <td style="font-family:var(--ff);color:var(--gold);font-weight:600;">${u.username}</td>
            <td>${u.nombre}</td>
            <td>${rolBadge[u.rol] || u.rol}</td>
            <td style="color:var(--text2);font-size:11px;">${u.email
              ? u.email
              : '<span style="color:var(--text3);">— sin correo —</span>'}</td>
            <td style="color:var(--text2);font-size:11px;">${formatDate(u.created_at)}</td>
            <td style="display:flex;gap:6px;">
              <button class="btn-sm" onclick="openUserModal('${u.id}')">Editar</button>
              ${u.email
                ? `<button class="btn-sm" onclick="enviarCredenciales('${u.id}')" title="Enviar usuario y contraseña por correo">✉ Credenciales</button>`
                : ''}
              ${u.username !== 'admin' ? `<button class="btn-sm danger" onclick="deleteUser('${u.id}')">Eliminar</button>` : ''}
            </td>
          </tr>`).join('')
      + '</tbody></table></div></div>';

  } catch(err) {
    container.innerHTML = errorBox('No se pudieron cargar los usuarios: ' + err.message);
  }
}

/* ══════════════════════════════════════════════
   MODAL — Gestión de Usuarios (Dinámico)
══════════════════════════════════════════════ */
async function openUserModal(userId) {
  editingUserId = userId || null;

  // Abrir modal con loading mientras cargamos datos
  document.getElementById('userModalTitle').textContent = userId ? 'Editar Usuario' : 'Nuevo Usuario';
  document.getElementById('userModalContent').innerHTML = loadingHTML('Cargando datos...');
  document.getElementById('modalUserBg').classList.add('open');

  // Cargar cines desde Supabase cp_maquinas (fuente de verdad permanente)
  let cinesUnicos = [];
  try {
    cinesUnicos = await DB.getCinesUnicos();
  } catch(e) {
    // Fallback al snapshot en memoria
    console.warn('[openUserModal] getCinesUnicos falló, usando snapshot:', e.message);
    const cat = (typeof D !== 'undefined' && D.catalogo_maquinas) ? D.catalogo_maquinas : [];
    cinesUnicos = [...new Set(cat.map(m => m.cine))].sort();
  }

  // Si estamos editando, obtener datos actuales del usuario
  let u = null;
  if (userId) {
    try {
      const users = await DB.getUsuarios();
      window._cachedUsers = users;
      u = users.find(x => x.id === userId) || null;
    } catch(e) {
      u = (window._cachedUsers || []).find(x => x.id === userId) || null;
    }
  }

  const cineOptions = cinesUnicos.length > 0
    ? cinesUnicos.map(c => `<option value="${c}" ${u?.nombre===c?'selected':''}>${c}</option>`).join('')
    : '<option value="">⚠️ Sube el Excel primero para ver los cines</option>';

  window.toggleUserForm = function() {
    const rol = document.getElementById('uRol').value;
    const isCine = (rol === 'cinepolis');
    document.getElementById('boxNombreCine').style.display   = isCine ? 'block' : 'none';
    document.getElementById('boxNombreTexto').style.display  = isCine ? 'none'  : 'block';
  };

  document.getElementById('userModalTitle').textContent = u ? 'Editar Usuario' : 'Nuevo Usuario';
  document.getElementById('userModalContent').innerHTML = `
    <div class="form-group" style="margin-bottom:14px;">
      <label class="form-label">Rol</label>
      <select class="form-select" id="uRol" onchange="toggleUserForm()" ${u && u.username === 'admin' ? 'disabled' : ''}>
        <option value="cinepolis"     ${u?.rol==='cinepolis'?'selected':''}>Cinépolis (Conjunto)</option>
        <option value="mantenimiento" ${u?.rol==='mantenimiento'?'selected':''}>Mantenimiento (Gerente)</option>
        <option value="tecnico"       ${u?.rol==='tecnico'?'selected':''}>Técnico (Campo)</option>
        <option value="ejecutivo"     ${u?.rol==='ejecutivo'?'selected':''}>Ejecutivo (Solo consulta)</option>
        <option value="admin"         ${u?.rol==='admin'?'selected':''}>Admin</option>
      </select>
    </div>

    <div class="form-group" id="boxNombreCine" style="margin-bottom:14px;">
      <label class="form-label">Nombre Exacto del Conjunto *</label>
      <select class="form-select" id="uNombreCine">
        <option value="">— Selecciona el Cine de la lista —</option>
        ${cineOptions}
      </select>
    </div>

    <div class="form-group" id="boxNombreTexto" style="margin-bottom:14px; display:none;">
      <label class="form-label">Nombre del Empleado *</label>
      <input class="form-input" id="uNombreTexto" type="text" value="${u && u.rol !== 'cinepolis' ? u.nombre : ''}" placeholder="Ej. Juan Pérez">
    </div>

    <div class="form-group" style="margin-bottom:14px;">
      <label class="form-label">Usuario (login)</label>
      <input class="form-input" id="uUser" type="text" value="${u ? u.username : ''}" placeholder="usuario123"
        ${u && u.username === 'admin' ? 'readonly' : ''} autocomplete="off">
    </div>

    <div class="form-group" style="margin-bottom:14px;">
      <label class="form-label">Correo electrónico</label>
      <input class="form-input" id="uEmail" type="email" value="${u && u.email ? u.email : ''}" placeholder="nombre@empresa.com" autocomplete="off">
      <div style="font-size:10px;color:var(--text3);margin-top:4px;">Necesario para poder enviarle sus datos de acceso.</div>
    </div>

    <div class="form-group" style="margin-bottom:20px;">
      <label class="form-label">Contraseña ${u ? '(vacío = no cambiar)' : '*'}</label>
      <input class="form-input" id="uPass" type="password" placeholder="••••••••" autocomplete="new-password">
    </div>

    <div style="display:flex;gap:10px;">
      <button class="btn-primary" id="saveUserBtn" onclick="saveUser()">Guardar</button>
      <button class="btn-ghost" onclick="closeUserModal()">Cancelar</button>
    </div>
    <div style="color:var(--red);font-size:12px;margin-top:8px;" id="userFormErr"></div>`;

  toggleUserForm();
}

async function saveUser() {
  const rol = document.getElementById('uRol').value;
  
  // Dependiendo del rol, tomamos el nombre del Select o del Input
  const nombre = (rol === 'cinepolis') 
    ? document.getElementById('uNombreCine').value 
    : document.getElementById('uNombreTexto').value.trim();

  const username = document.getElementById('uUser').value.trim().toLowerCase();
  const email    = (document.getElementById('uEmail')?.value || '').trim().toLowerCase();
  const pass     = document.getElementById('uPass').value;
  const err      = document.getElementById('userFormErr');
  const btn      = document.getElementById('saveUserBtn');

  if (!nombre || !username) { err.textContent = 'Nombre y usuario son obligatorios'; return; }

  btn.disabled = true; btn.textContent = 'Guardando...';

  try {
    const ts = nowISO();
    if (editingUserId) {
      const cambios = { nombre, username, rol, email, updated_at: ts };
      if (pass) cambios.password = pass;
      await DB.actualizarUsuario(editingUserId, cambios);
      showToast('Usuario actualizado', 'success');
    } else {
      if (!pass) { err.textContent = 'La contraseña es obligatoria'; return; }
      await DB.crearUsuario({
        id: newId('u'), username, password: pass, rol, nombre, email,
        activo: 1, created_at: ts, updated_at: ts,
      });
      showToast('Usuario creado', 'success');
    }
    closeUserModal();
    renderTab('usuarios');
  } catch(e) {
    err.textContent = 'Error: ' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

async function deleteUser(userId) {
  if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
  try {
    await DB.desactivarUsuario(userId);
    showToast('Usuario eliminado', 'success');
    renderTab('usuarios');
  } catch(e) { showToast('Error: ' + e.message, 'error'); }
}

function closeUserModal(e) {
  if (e && e.target !== document.getElementById('modalUserBg')) return;
  document.getElementById('modalUserBg').classList.remove('open');
  editingUserId = null;
}
/* ── Log de Auditoría ────────────────────────── */
async function renderLog(container) {
  container.innerHTML = loadingHTML('Cargando log de Supabase...');
  try {
    const logs = await DB.getLog();
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">'
      + '<div><div style="font-family:var(--ff);font-size:18px;font-weight:700;">📋 Log de Auditoría</div>'
      + '<div style="font-size:11px;color:var(--text2);margin-top:2px;">'+ logs.length +' entradas · cp_incidencias_log en Supabase</div></div>'
      + '<button class="btn-ghost" onclick="renderTab(\'usuarios\')">← Volver</button></div>'
      + '<div class="twrap"><div class="tscroll"><table>'
      + '<thead><tr><th>Fecha</th><th>Incidencia</th><th>Usuario</th><th>Acción</th><th>Estado Anterior</th><th>Estado Nuevo</th><th>Nota</th></tr></thead>'
      + '<tbody>' + (logs.length ? logs.map(l => {
          const acBadge = {
            'creacion':     '<span class="badge bg">creación</span>',
            'cambio_estado':'<span class="badge bb">cambio estado</span>',
            'eliminacion':  '<span class="badge br">eliminación</span>',
          }[l.accion] || `<span class="badge bw">${l.accion}</span>`;
          const nota = (l.nota||'').substring(0,50) + ((l.nota||'').length>50?'…':'');
          return `<tr>
            <td style="color:var(--text2);font-size:11px;white-space:nowrap;">${formatDate(l.created_at)}</td>
            <td style="font-family:var(--ff);color:var(--gold);">${l.incidencia_id}</td>
            <td style="color:var(--cyan);font-size:11px;">${l.nombre_usuario}</td>
            <td>${acBadge}</td>
            <td>${estadoBadge(l.estado_anterior)}</td>
            <td>${estadoBadge(l.estado_nuevo)}</td>
            <td style="color:var(--text2);font-size:11px;" title="${(l.nota||'').replace(/"/g,"'")}">${nota}</td>
          </tr>`;
        }).join('') : '<tr><td colspan="7" class="nodata">Sin entradas en el log</td></tr>')
      + '</tbody></table></div></div>';
  } catch(err) {
    container.innerHTML = errorBox('No se pudo cargar el log: ' + err.message);
  }
}
/* ══════════════════════════════════════════════
   ENVÍO DE CREDENCIALES POR CORREO
   La app deja el correo en la cola (cp_correos_pendientes)
   y el script credenciales_correo.py lo envía.
══════════════════════════════════════════════ */

// Genera una contraseña temporal legible (sin caracteres confusos)
function generarPasswordTemporal(largo = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < largo; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

async function enviarCredenciales(userId) {
  if (!requireRole('admin')) return;

  let u = null;
  try {
    const users = await DB.getUsuarios();
    u = users.find(x => x.id === userId);
  } catch (e) { showToast('Error al leer el usuario: ' + e.message, 'error'); return; }

  if (!u)        { showToast('Usuario no encontrado', 'error'); return; }
  if (!u.email)  { showToast('Ese usuario no tiene correo registrado. Edítalo y agrégaselo.', 'error'); return; }

  document.getElementById('userModalTitle').textContent = 'Enviar credenciales';
  document.getElementById('userModalContent').innerHTML = `
    <div style="font-size:13px;line-height:1.7;margin-bottom:16px;">
      Se le enviarán sus datos de acceso a:<br>
      <strong style="color:var(--gold);">${u.nombre}</strong><br>
      <span style="color:var(--cyan);">${u.email}</span>
    </div>
    <div style="background:rgba(247,196,0,.08);border-left:3px solid var(--gold);border-radius:0 6px 6px 0;padding:10px 14px;font-size:12px;color:var(--text2);line-height:1.6;margin-bottom:18px;">
      <strong style="color:var(--gold);">Recomendado:</strong> generar una contraseña temporal.
      La contraseña queda escrita en su bandeja de correo, por eso conviene que sea
      temporal y que el usuario la cambie al entrar.
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button class="btn-primary" onclick="confirmarEnvioCredenciales('${u.id}', true)">
        🔐 Generar contraseña temporal y enviar
      </button>
      <button class="btn-ghost" onclick="confirmarEnvioCredenciales('${u.id}', false)">
        Enviar su contraseña actual
      </button>
      <button class="btn-ghost" onclick="closeUserModal()">Cancelar</button>
    </div>
    <div style="color:var(--red);font-size:12px;margin-top:10px;" id="credErr"></div>`;
  document.getElementById('modalUserBg').classList.add('open');
}

async function confirmarEnvioCredenciales(userId, generarNueva) {
  const err = document.getElementById('credErr');
  if (err) err.textContent = '';

  try {
    const users = await DB.getUsuarios();
    const u = users.find(x => x.id === userId);
    if (!u) throw new Error('Usuario no encontrado');

    let password = u.password;

    // Si se pidió temporal, la generamos y la guardamos ANTES de mandar el correo
    if (generarNueva) {
      password = generarPasswordTemporal();
      await DB.actualizarUsuario(userId, { password });
    }

    await DB.encolarCorreo({
      id:      newId('mail'),
      para:    u.email,
      asunto:  'Tus accesos — Centro de Servicio Galex',
      cuerpo:  plantillaCredenciales(u, password, generarNueva),
      tipo:    'credenciales',
      enviado: 0,
      solicitado_por: currentUser.username,
      created_at: nowISO(),
    });

    closeUserModal();
    showToast(generarNueva
      ? 'Contraseña temporal generada y correo en cola ✓'
      : 'Correo en cola de envío ✓', 'success');
    renderTab('usuarios');

  } catch (e) {
    if (err) err.textContent = 'Error: ' + e.message;
    else showToast('Error: ' + e.message, 'error');
  }
}

// Cuerpo HTML del correo, con los colores de Cinépolis
function plantillaCredenciales(u, password, esTemporal) {
  const rolTxt = {
    cinepolis:'Cine', mantenimiento:'Mantenimiento', tecnico:'Técnico',
    ejecutivo:'Ejecutivo', admin:'Administrador'
  }[u.rol] || u.rol;

  const urlApp = window.location.origin;

  return `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f2f2f2;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #dfe5f0;">
    <div style="background:#162b57;padding:22px 26px;">
      <div style="color:#ffffff;font-size:19px;font-weight:bold;">Centro de Servicio Galex</div>
      <div style="color:#9fb6e0;font-size:12px;margin-top:3px;">Gestión de máquinas · Cinépolis</div>
    </div>
    <div style="padding:26px;color:#1f2a44;font-size:14px;line-height:1.7;">
      <p style="margin:0 0 14px;">Hola <strong>${u.nombre}</strong>,</p>
      <p style="margin:0 0 18px;">Estos son tus datos para entrar al Centro de Servicio Galex:</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:18px;">
        <tr>
          <td style="padding:9px 12px;background:#eef1f7;border:1px solid #dfe5f0;width:38%;"><strong>Usuario</strong></td>
          <td style="padding:9px 12px;border:1px solid #dfe5f0;font-family:Consolas,monospace;">${u.username}</td>
        </tr>
        <tr>
          <td style="padding:9px 12px;background:#eef1f7;border:1px solid #dfe5f0;"><strong>Contraseña</strong></td>
          <td style="padding:9px 12px;border:1px solid #dfe5f0;font-family:Consolas,monospace;">${password}</td>
        </tr>
        <tr>
          <td style="padding:9px 12px;background:#eef1f7;border:1px solid #dfe5f0;"><strong>Perfil</strong></td>
          <td style="padding:9px 12px;border:1px solid #dfe5f0;">${rolTxt}</td>
        </tr>
      </table>

      <div style="text-align:center;margin:22px 0;">
        <a href="${urlApp}" style="background:#f7c400;color:#162b57;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:6px;display:inline-block;">Entrar a la aplicación</a>
      </div>

      <div style="background:#fff8dd;border-left:4px solid #f7c400;padding:12px 16px;font-size:13px;margin-bottom:16px;">
        ${esTemporal
          ? '<strong>Esta contraseña es temporal.</strong> Al entrar, cámbiala desde el botón “🔑 Contraseña” que está arriba a la derecha.'
          : 'Por seguridad, cambia tu contraseña al entrar, desde el botón “🔑 Contraseña” que está arriba a la derecha.'}
      </div>

      <p style="margin:0 0 6px;font-size:13px;color:#5b6f96;">Puedes instalar la aplicación en tu celular: abre el enlace en el navegador y elige “Instalar app” o “Agregar a inicio”.</p>
      <p style="margin:14px 0 0;font-size:13px;color:#5b6f96;">No compartas estos datos con nadie más.</p>
    </div>
    <div style="background:#eef1f7;padding:14px 26px;font-size:11px;color:#6b7ea6;text-align:center;">
      Galex 2026 · Todos los derechos reservados
    </div>
  </div>
</div>`;
}
