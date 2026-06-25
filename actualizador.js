/* ═══════════════════════════════════════════════
   actualizador.js — Carga manual del Excel
   Respaldo por si el script de Python no corrió.
   Compatible con SLA_Cinepolis.xlsx
   ═══════════════════════════════════════════════ */

function renderActualizador(container) {
  container.innerHTML = `
    <div style="max-width:720px;margin:0 auto;">
      <div style="margin-bottom:24px;">
        <div style="font-family:var(--ff);font-size:20px;font-weight:700;margin-bottom:4px;">⚡ Actualizar Datos Manualmente</div>
        <div style="font-size:12px;color:var(--text2);line-height:1.8;">
          Sube <strong style="color:var(--gold);">SLA_Cinepolis.xlsx</strong> para actualizar el dashboard.<br>
          Hojas requeridas: <span style="color:var(--cyan);">Listar Maquinas Cinepolis</span> ·
          <span style="color:var(--cyan);">Listar Incidencia Cinepolis</span> ·
          <span style="color:var(--cyan);">Venta Semanal</span>
        </div>
      </div>

      <div class="upd-zone" id="updZone">
        <input type="file" id="updFile" accept=".xlsx,.xls" onchange="procesarExcel(event)">
        <div class="upd-icon">📊</div>
        <div class="upd-title">Arrastra SLA_Cinepolis.xlsx aquí o haz clic</div>
        <div class="upd-sub">Máx 30 MB</div>
      </div>

      <div class="upd-progress" id="updProgress">
        <div class="upd-step" id="updStep">Iniciando...</div>
        <div class="upd-bar-wrap"><div class="upd-bar" id="updBar"></div></div>
      </div>

      <div class="upd-result" id="updResult"></div>

      <div style="margin-top:20px;padding:14px 16px;background:var(--panel);border:1px solid var(--border);border-radius:8px;">
        <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px;">Última actualización</div>
        <div style="font-size:13px;color:var(--text2);">
          <span style="color:var(--gold);font-weight:600;" id="updLastDate">${D.fecha_actualizacion || 'Sin datos'}</span>
        </div>
        <div style="font-size:11px;color:var(--text3);margin-top:4px;">
          Incidencias: ${D.incidencias.length} · Alerta venta: ${D.venta_alerta.length}
        </div>
      </div>
    </div>`;

  const zone = document.getElementById('updZone');
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', ()  => zone.classList.remove('drag'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f) _procesarDesdeFile(f);
  });
}

function procesarExcel(event) {
  const f = event.target.files[0];
  if (f) _procesarDesdeFile(f);
}

async function _procesarDesdeFile(file) {
  const setStep = (txt, pct) => {
    const s = document.getElementById('updStep'), b = document.getElementById('updBar');
    if (s) s.textContent = txt;
    if (b) b.style.width  = pct + '%';
  };
  const showErr = (msg) => {
    const el = document.getElementById('updResult');
    if (el) { el.className='upd-result err'; el.innerHTML=`❌ ${msg}`; el.style.display='block'; }
  };

  document.getElementById('updProgress').style.display = 'block';
  document.getElementById('updResult').style.display   = 'none';
  setStep('Leyendo archivo...', 5);

  try {
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type:'array', cellDates:true });
    setStep('Identificando hojas...', 12);

    const getHoja = (...keys) => {
      for (const k of keys) {
        const name = wb.SheetNames.find(n => n.toUpperCase().includes(k.toUpperCase()));
        if (name) return XLSX.utils.sheet_to_json(wb.Sheets[name], { defval:'' });
      }
      return [];
    };

    const rawMaq = getHoja('MAQUINAS', 'MÁQUINAS');
    const rawInc = getHoja('INCIDENCIA', 'INCIDENCIAS');
    const rawVta = getHoja('VENTA', 'SEMANAL');

    if (!rawMaq.length && !rawInc.length) {
      showErr('No se encontraron las hojas. ¿Es el archivo SLA_Cinepolis.xlsx correcto?');
      return;
    }
    setStep(`Máq:${rawMaq.length} Inc:${rawInc.length} Vta:${rawVta.length}`, 22);

    // ── MÁQUINAS ──────────────────────────────────────────
    setStep('Procesando máquinas...', 30);
    const maquinas = rawMaq.map(r => {
      const id     = _s(r['Serie']           || r['NUM_SERIE']       || r['SERIE'] || '');
      const nombre = _s(r['Nombre de Maquina']|| r['NOMBRE_MAQUINA'] || r['Nombre']|| '');
      const cine   = _s(r['Conjunto']         || r['CONJUNTO']        || r['Cine'] || '').toUpperCase();
      const estado = _s(r['Estado']           || r['ESTADO']          || 'EN RUTA').toUpperCase();
      if (!id) return null;
      return { id, nombre, cine, estado,
        region: _s(r['Region'] || r['REGION'] || ''),
        ruta:   _s(r['Ruta']   || r['RUTA']   || '') };
    }).filter(Boolean);

    const catalogo_maquinas  = maquinas.filter(m => m.estado === 'EN RUTA');
    const maquinas_en_ruta   = catalogo_maquinas.length;

    // ── INCIDENCIAS ───────────────────────────────────────
    setStep('Calculando incidencias...', 44);
    const hoy = new Date();
    const diasEntre = (v) => {
      if (!v) return 0;
      try {
        const f = (v instanceof Date) ? v : new Date(String(v));
        if (isNaN(f)) return 0;
        return Math.max(0, Math.floor((hoy - f) / 86_400_000));
      } catch { return 0; }
    };

    const incidencias = rawInc.map(r => {
      // Filtrar solo abiertas (FechaCierre año 2000 = nunca cerrada)
      const fcierre = _s(r['FechaCierre'] || r['Fecha Cierre'] || '');
      if (fcierre && !fcierre.startsWith('2000')) return null;

      const serie = _s(r['serie'] || r['Serie'] || r['SERIE'] || '');
      if (!serie) return null;

      const clasificacion = _s(r['Clasificacion'] || r['Clasificación'] ||
                                r['Clasificacion Incidencia'] || '');
      const clasifInc = clasificacion.toLowerCase().includes('refacc')
        ? 'BACK ORDER' : 'EN DIAGNOSTICO';

      const dias     = diasEntre(r['FechaCreacion'] || r['Fecha Apertura'] || r['Fecha'] || '');
      const prioridad = dias > 30 ? 'Urgente' : 'Normal';

      return {
        IdIncidencia:              _s(r['idIncidencia'] || r['IdIncidencia'] || r['ID'] || ''),
        Serie:                      serie,
        'Nombre de Incidencia':     clasificacion,
        'Clasificacion Incidencia': clasifInc,
        Conjunto:                   _s(r['Conjunto'] || r['CONJUNTO'] || ''),
        Region:                     _s(r['Region']   || r['REGION']   || ''),
        Ruta:                       _s(r['Ruta']     || r['RUTA']     || ''),
        Operador:                   _s(r['Operador'] || r['OPERADOR'] || ''),
        Prioridad:                   prioridad,
        Observaciones:              _s(r['Nombre de la incidencia'] || r['Observaciones'] || ''),
        dias_abierta:                dias,
      };
    }).filter(Boolean);

    const back_order   = incidencias.filter(r => r['Clasificacion Incidencia'] === 'BACK ORDER').length;
    const mas_90_dias  = incidencias.filter(r => r.dias_abierta > 90).length;

    const by_region = Object.entries(
      incidencias.reduce((a,r) => { a[r.Region||'Sin región']=(a[r.Region||'Sin región']||0)+1; return a; }, {})
    ).map(([Region,total]) => ({Region,total}));

    const nombre_count = incidencias.reduce((a,r) => {
      const k=r['Nombre de Incidencia']||'Sin tipo'; a[k]=(a[k]||0)+1; return a; },{});
    const clasif_count = incidencias.reduce((a,r) => {
      const k=r['Clasificacion Incidencia']||'EN DIAGNOSTICO'; a[k]=(a[k]||0)+1; return a; },{});
    const dias_ranges  = {'0-30':0,'31-60':0,'61-90':0,'+90':0};
    incidencias.forEach(r => {
      const d=r.dias_abierta;
      if(d<=30)dias_ranges['0-30']++;else if(d<=60)dias_ranges['31-60']++;
      else if(d<=90)dias_ranges['61-90']++;else dias_ranges['+90']++;
    });

    // ── VENTA SEMANAL ─────────────────────────────────────
    setStep('Analizando ventas...', 60);
    const semCols = rawVta.length
      ? Object.keys(rawVta[0]).filter(k => /^SEMANA_\d+$/i.test(k.trim()))
        .sort((a,b) => parseInt(a.split('_')[1]) - parseInt(b.split('_')[1]))
      : [];
    const semana_cols_last4 = semCols.slice(-4);

    const ventaMap = {};
    rawVta.forEach(r => {
      const ns = _s(r['NUM_SERIE'] || r['Serie'] || r['SERIE'] || '');
      if (!ns) return;
      const vals = semCols.map(s => _n(r[s]));
      const total = _n(r['TOTAL'] || r['TOTAL_VENTA'] || '') || vals.reduce((a,b)=>a+b,0);
      const avg   = vals.length ? total / vals.length : 0;
      let maxC=0,cur=0;
      vals.forEach(v => { cur=v===0?cur+1:0; maxC=Math.max(maxC,cur); });
      const sd={};
      semCols.forEach(s => sd[s]=_n(r[s]));
      ventaMap[ns] = { NUM_SERIE:ns,
        NOMBRE_MAQUINA: _s(r['NOMBRE_MAQUINA']||r['Nombre']||''),
        CONJUNTO: _s(r['CONJUNTO']||r['Conjunto']||'').toUpperCase(),
        REGION:   _s(r['REGION']  ||r['Region']  ||''),
        RUTA:     _s(r['RUTA']    ||r['Ruta']    ||''),
        TOTAL_VENTA:total, avg_semanal:avg, max_consec_zeros:maxC, ...sd };
    });

    const venta_alerta      = Object.values(ventaMap).filter(r => r.max_consec_zeros >= 2);
    const alertas_venta_cero = venta_alerta.length;
    const top_priority      = incidencias
      .map(r => { const v=ventaMap[r.Serie]||{}; return {...r,avg_semanal:v.avg_semanal||0,TOTAL_VENTA:v.TOTAL_VENTA||0}; })
      .sort((a,b) => (b.avg_semanal||0)-(a.avg_semanal||0));

    // ── SNAPSHOT ──────────────────────────────────────────
    setStep('Guardando en Supabase...', 82);
    const fecha_actualizacion = new Date().toLocaleString('es-MX',
      {day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});

    const snapshot = {
      kpi: { maquinas_en_ruta, total_incidencias_abiertas:incidencias.length,
             back_order, mas_90_dias, alertas_venta_cero, romel_total:0, romel_no_en_sistema:0 },
      incidencias, top_priority, venta_alerta, romel:[],
      by_region, nombre_count, clasif_count, dias_ranges,
      semana_cols_last4, catalogo_maquinas, fecha_actualizacion,
    };

    await DB.guardarDashboard(snapshot, currentUser.username);

    setStep('Sincronizando máquinas...', 93);
    if (maquinas.length) await DB.sincronizarMaquinas(maquinas);

    Object.assign(D, snapshot);
    const fb = document.getElementById('fechaBadge');
    if (fb) { fb.textContent = D.fecha_actualizacion; fb.style.display='block'; }
    const ld = document.getElementById('updLastDate');
    if (ld) ld.textContent = D.fecha_actualizacion;

    setStep('¡Listo!', 100);

    const res = document.getElementById('updResult');
    res.className = 'upd-result ok'; res.style.display = 'block';
    res.innerHTML = `
      <div style="font-weight:700;font-size:14px;margin-bottom:14px;">✅ Dashboard actualizado — ${fecha_actualizacion}</div>
      <div class="upd-kpi-grid">
        ${_updKpi(maquinas_en_ruta,           'Máquinas')}
        ${_updKpi(incidencias.length,         'Incidencias')}
        ${_updKpi(back_order,                 'Back Order')}
        ${_updKpi(mas_90_dias,                '+90 días')}
        ${_updKpi(alertas_venta_cero,         'Alerta Venta')}
      </div>`;
    showToast('Dashboard actualizado ✓', 'success');

  } catch(err) {
    console.error('[actualizador]', err);
    showErr(err.message);
    const bar = document.getElementById('updBar');
    if (bar) bar.style.background = 'var(--red)';
  }
}

function _s(v)  { return v==null?'':String(v).trim(); }
function _n(v)  { if(v==null)return 0; const n=parseFloat(String(v).replace(/[^0-9.-]/g,'')); return isNaN(n)?0:n; }
function _updKpi(val,lbl) {
  return `<div class="upd-kpi"><div class="upd-kpi-val">${Number(val).toLocaleString('es-MX')}</div><div class="upd-kpi-lbl">${lbl}</div></div>`;
}
