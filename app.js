/* ══════════════════════════════════════════════════════════════
   NEXUS PWA v4 — app.js
   ══════════════════════════════════════════════════════════════ */

/* ── GOOGLE SHEETS ENDPOINT ─────────────────────────────────────
   Parámetros = nombres exactos de columnas del Sheet:
   nombres | direccion | email | ciudad | valEasting | valNorthing
   ─────────────────────────────────────────────────────────────── */
const GS_URL = 'https://script.google.com/macros/s/AKfycbx1e4V5gJ6HBwYHv3bb6G1Im7laFKWVXRQhvc4gxxg6CJYI5UTHrSQGTNJb9RvK0xQn/exec';

/* ── INDEXEDDB ───────────────────────────────────────────────────
   Claves = nombres exactos de columnas del Sheet
   nombres | direccion | email | ciudad | valEasting | valNorthing
   + extras GPS: utmZone, utmHemi, gpsLat, gpsLng, gpsAcc
   ─────────────────────────────────────────────────────────────── */
const DB_NAME = 'nexus_v4';
const DB_VER  = 1;
const STORE   = 'contacts';
let db;

function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE)) {
        const s = d.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        s.createIndex('nombres', 'nombres', { unique: false });
        s.createIndex('ciudad',  'ciudad',  { unique: false });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = e => rej(e.target.error);
  });
}

function txStore(mode = 'readonly') {
  return db.transaction(STORE, mode).objectStore(STORE);
}
const dbGetAll = ()   => new Promise((r,j) => { const q = txStore().getAll();          q.onsuccess = e => r(e.target.result); q.onerror = e => j(e.target.error); });
const dbGet    = id   => new Promise((r,j) => { const q = txStore().get(id);           q.onsuccess = e => r(e.target.result); q.onerror = e => j(e.target.error); });
const dbAdd    = data => new Promise((r,j) => { const q = txStore('readwrite').add(data); q.onsuccess = e => r(e.target.result); q.onerror = e => j(e.target.error); });
const dbPut    = data => new Promise((r,j) => { const q = txStore('readwrite').put(data); q.onsuccess = e => r(e.target.result); q.onerror = e => j(e.target.error); });
const dbDel    = id   => new Promise((r,j) => { const q = txStore('readwrite').delete(id); q.onsuccess = () => r();            q.onerror = e => j(e.target.error); });

/* ── UI STATE ────────────────────────────────────────────────── */
let allRecords  = [];
let editingId   = null;
let delTargetId = null;

/* ── HELPERS ─────────────────────────────────────────────────── */
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function initials(n) {
  return n.trim().split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

/* ── RENDER LIST ─────────────────────────────────────────────── */
function renderList(records) {
  const el = document.getElementById('contactsList');
  if (!records.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">◈</div><p>Sin resultados.</p></div>`;
    return;
  }
  el.innerHTML = records.map(r => `
    <div class="c-card">
      <div class="c-avatar">${initials(r.nombres)}</div>
      <div class="c-info">
        <div class="c-name">${esc(r.nombres)}</div>
        <div class="c-meta">${esc(r.email)}</div>
        <div class="c-meta">${esc(r.direccion)}</div>
        <span class="c-city">${esc(r.ciudad)}</span>
        ${r.valEasting ? `<div class="c-utm">📍 UTM ${esc(r.utmZone||'')}${esc(r.utmHemi||'')} E:${esc(r.valEasting)} N:${esc(r.valNorthing)}</div>` : ''}
      </div>
      <div class="c-actions">
        <button class="btn btn-edit"   onclick="startEdit(${r.id})">✎</button>
        <button class="btn btn-danger" onclick="askDel(${r.id},'${esc(r.nombres)}')">✕</button>
      </div>
    </div>`).join('');
}

function updateStats() {
  document.getElementById('totalCount').textContent = allRecords.length;
  document.getElementById('cityCount').textContent  = new Set(allRecords.map(r => r.ciudad.toLowerCase())).size;
  // Pending badge
  const pb = document.getElementById('pendingBadge');
  if (allRecords.length > 0) {
    pb.style.display = 'inline-flex';
    document.getElementById('pendingCount').textContent = allRecords.length;
  } else {
    pb.style.display = 'none';
  }
  // Send button state
  document.getElementById('btnSend').disabled = allRecords.length === 0 || !navigator.onLine;
}

async function loadAll() {
  allRecords = await dbGetAll();
  const q = document.getElementById('searchInput').value.toLowerCase();
  const filtered = q
    ? allRecords.filter(r =>
        r.nombres.toLowerCase().includes(q) ||
        r.ciudad.toLowerCase().includes(q)  ||
        r.email.toLowerCase().includes(q))
    : allRecords;
  renderList(filtered);
  updateStats();
}

/* ── FORM ────────────────────────────────────────────────────────
   getFields — IDs = nombres exactos de columnas del Sheet
   ─────────────────────────────────────────────────────────────── */
function getFields() {
  return {
    nombres:     document.getElementById('nombres').value.trim(),
    direccion:   document.getElementById('direccion').value.trim(),
    email:       document.getElementById('email').value.trim(),
    ciudad:      document.getElementById('ciudad').value.trim(),
    valEasting:  document.getElementById('valEasting').value,
    valNorthing: document.getElementById('valNorthing').value,
    utmZone:     document.getElementById('utmZone').value,
    utmHemi:     document.getElementById('utmHemi').value,
    gpsLat:      document.getElementById('gpsLat').value,
    gpsLng:      document.getElementById('gpsLng').value,
    gpsAcc:      document.getElementById('gpsAcc').value,
  };
}

function clearErrors() {
  document.querySelectorAll('.emsg').forEach(e => e.classList.remove('show'));
  document.querySelectorAll('input').forEach(i => i.classList.remove('err'));
}

function fieldErr(id, msgId) {
  document.getElementById(id)?.classList.add('err');
  document.getElementById(msgId)?.classList.add('show');
}

function validate(f) {
  let ok = true;
  if (!f.nombres)                                                  { fieldErr('nombres',   'e-nombres');   ok = false; }
  if (!f.direccion)                                                { fieldErr('direccion', 'e-direccion'); ok = false; }
  if (!f.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email))   { fieldErr('email',     'e-email');     ok = false; }
  if (!f.ciudad)                                                   { fieldErr('ciudad',    'e-ciudad');    ok = false; }
  return ok;
}

function resetForm() {
  document.getElementById('contactForm').reset();
  document.getElementById('recordId').value = '';
  clearErrors();
  editingId = null;
  document.getElementById('formChip').textContent = 'Nuevo registro';
  document.getElementById('formChip').className   = 'chip';
  document.getElementById('submitBtn').innerHTML  = `
    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
    Guardar`;
  document.getElementById('cancelEditBtn')?.remove();
  if (window._resetCiudad) window._resetCiudad();
  if (window._resetUTM)    window._resetUTM();
}

document.getElementById('contactForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearErrors();
  const f = getFields();
  if (!validate(f)) return;
  try {
    if (editingId) {
      await dbPut({ id: editingId, ...f });
      showToast('Registro actualizado ✓');
    } else {
      await dbAdd(f);
      showToast('Registro guardado localmente ✓');
    }
    resetForm();
    await loadAll();
  } catch (err) {
    showToast('Error al guardar: ' + err.message, true);
  }
});

/* ── EDIT ────────────────────────────────────────────────────── */
async function startEdit(id) {
  const r = await dbGet(id);
  if (!r) return;
  editingId = id;
  document.getElementById('recordId').value      = id;
  document.getElementById('nombres').value       = r.nombres;
  document.getElementById('direccion').value     = r.direccion;
  document.getElementById('email').value         = r.email;
  document.getElementById('ciudad').value        = r.ciudad;
  document.getElementById('ciudadVisible').value = r.ciudad;
  document.getElementById('valEasting').value    = r.valEasting  || '';
  document.getElementById('valNorthing').value   = r.valNorthing || '';
  document.getElementById('utmZone').value       = r.utmZone     || '';
  document.getElementById('utmHemi').value       = r.utmHemi     || '';
  document.getElementById('gpsLat').value        = r.gpsLat      || '';
  document.getElementById('gpsLng').value        = r.gpsLng      || '';
  document.getElementById('gpsAcc').value        = r.gpsAcc      || '';

  if (r.valEasting) {
    document.getElementById('dispEasting').textContent  = Number(r.valEasting).toLocaleString() + ' m';
    document.getElementById('dispNorthing').textContent = Number(r.valNorthing).toLocaleString() + ' m';
    document.getElementById('dispZone').textContent     = `Zona ${r.utmZone} ${r.utmHemi === 'N' ? '— Norte' : '— Sur'}`;
    ['dispEasting','dispNorthing','dispZone'].forEach(x => document.getElementById(x).classList.remove('empty'));
  }

  document.getElementById('formChip').textContent = 'Editando';
  document.getElementById('formChip').className   = 'chip edit';
  document.getElementById('submitBtn').innerHTML  = `
    <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>
    Actualizar`;

  if (!document.getElementById('cancelEditBtn')) {
    const btn = Object.assign(document.createElement('button'), {
      type: 'button', id: 'cancelEditBtn',
      className: 'btn btn-secondary', textContent: 'Cancelar'
    });
    btn.onclick = resetForm;
    document.getElementById('formActions').appendChild(btn);
  }
  document.getElementById('formCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ── DELETE ──────────────────────────────────────────────────── */
function askDel(id, name) {
  delTargetId = id;
  document.getElementById('delName').textContent = name;
  document.getElementById('delBackdrop').classList.add('show');
  document.getElementById('delModal').classList.add('show');
}
function closeDel() {
  document.getElementById('delBackdrop').classList.remove('show');
  document.getElementById('delModal').classList.remove('show');
  delTargetId = null;
}
document.getElementById('cancelDel').addEventListener('click', closeDel);
document.getElementById('delBackdrop').addEventListener('click', closeDel);
document.getElementById('confirmDel').addEventListener('click', async () => {
  if (!delTargetId) return;
  await dbDel(delTargetId);
  if (editingId === delTargetId) resetForm();
  closeDel();
  await loadAll();
  showToast('Registro eliminado ✓');
});

/* ── SEND TO GOOGLE SHEETS ───────────────────────────────────────
   GET + query string: único método que GAS lee con mode:no-cors.
   Parámetros = nombres exactos de columnas del Sheet.
   ─────────────────────────────────────────────────────────────── */
function openSendModal() {
  if (!navigator.onLine)   { showToast('⚠️ Sin conexión. Conéctate para enviar.', true); return; }
  if (!allRecords.length)  { showToast('No hay registros para enviar.', true); return; }
  document.getElementById('sendCount').textContent = allRecords.length;
  const cities = [...new Set(allRecords.map(r => r.ciudad))];
  document.getElementById('sendSummary').innerHTML =
    `<strong>${allRecords.length}</strong> registro(s) · <strong>${cities.length}</strong> ciudad(es)<br>
     ${cities.slice(0,4).join(', ')}${cities.length > 4 ? ` y ${cities.length - 4} más…` : ''}`;
  document.getElementById('sendBackdrop').classList.add('show');
  document.getElementById('sendModal').classList.add('show');
}
function closeSendModal() {
  document.getElementById('sendBackdrop').classList.remove('show');
  document.getElementById('sendModal').classList.remove('show');
}
document.getElementById('cancelSend').addEventListener('click', closeSendModal);
document.getElementById('sendBackdrop').addEventListener('click', closeSendModal);
document.getElementById('btnSend').addEventListener('click', openSendModal);

document.getElementById('confirmSend').addEventListener('click', async () => {
  closeSendModal();
  if (!navigator.onLine) { showToast('⚠️ Sin conexión.', true); return; }

  const records = await dbGetAll();
  if (!records.length)   { showToast('Sin registros.', true); return; }

  const progress = document.getElementById('sendProgress');
  const spTxt    = document.getElementById('spTxt');
  const spSub    = document.getElementById('spSub');
  progress.classList.add('show');

  let ok = 0, fail = 0;

  for (const r of records) {
    spTxt.textContent = `Enviando ${ok + fail + 1} de ${records.length}…`;
    spSub.textContent = r.nombres || '';

    // Parámetros = columnas exactas del Sheet
    const params = new URLSearchParams({
      nombres:     r.nombres     || '',
      direccion:   r.direccion   || '',
      email:       r.email       || '',
      ciudad:      r.ciudad      || '',
      valEasting:  r.valEasting  || '',
      valNorthing: r.valNorthing || '',
    });

    try {
      await fetch(`${GS_URL}?${params.toString()}`, {
        method: 'GET',
        mode:   'no-cors',
      });
      ok++;
    } catch (e) {
      fail++;
      console.warn('Error enviando:', r.nombres, e.message);
    }
  }

  spTxt.textContent = ok > 0 ? '¡Enviado!' : 'Sin envíos';
  spSub.textContent = 'Limpiando registros locales…';

  const toDelete = records.slice(0, ok);
  await Promise.all(toDelete.map(r => dbDel(r.id)));
  await loadAll();

  progress.classList.remove('show');

  if (fail === 0) {
    showToast(`✅ ${ok} registro(s) enviados y borrados localmente`);
  } else {
    showToast(`⚠️ ${ok} enviados, ${fail} fallaron. Reintenta.`, true);
  }
});

/* ── ONLINE / OFFLINE ────────────────────────────────────────── */
const offBanner = document.getElementById('offlineBanner');
const onToast   = document.getElementById('onlineToast');
const connDot   = document.getElementById('connDot');
const connLabel = document.getElementById('connLabel');
let onTimer;

function setConn(online) {
  connDot.className     = `conn-dot ${online ? 'on' : 'off'}`;
  connLabel.textContent = online ? 'En línea' : 'Sin conexión';
  if (online) {
    offBanner.classList.remove('show');
    onToast.classList.add('show');
    clearTimeout(onTimer);
    onTimer = setTimeout(() => onToast.classList.remove('show'), 4000);
  } else {
    onToast.classList.remove('show');
    offBanner.classList.add('show');
  }
  updateStats();
}

window.addEventListener('online',  () => setConn(true));
window.addEventListener('offline', () => setConn(false));
if (!navigator.onLine) setConn(false);

/* ── SEARCH ──────────────────────────────────────────────────── */
document.getElementById('searchInput').addEventListener('input', loadAll);

/* ── TOAST ───────────────────────────────────────────────────── */
let toastTimer;
function showToast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

/* ── WGS84 → UTM CONVERSION ──────────────────────────────────── */
function toUTM(lat, lng) {
  const a  = 6378137, f = 1/298.257223563, b = a*(1-f);
  const e2 = 1-(b*b)/(a*a), e4 = e2*e2, e6 = e4*e2;
  const k0 = 0.9996, E0 = 500000;
  const zone = Math.floor((lng+180)/6)+1;
  const λ0 = ((zone-1)*6-180+3)*Math.PI/180;
  const φ  = lat*Math.PI/180, λ = lng*Math.PI/180;
  const N  = a/Math.sqrt(1-e2*Math.sin(φ)**2);
  const T  = Math.tan(φ)**2;
  const C  = (e2/(1-e2))*Math.cos(φ)**2;
  const A  = Math.cos(φ)*(λ-λ0);
  const M  = a * (
    (1-e2/4-3*e4/64-5*e6/256)*φ
    - (3*e2/8+3*e4/32+45*e6/1024)*Math.sin(2*φ)
    + (15*e4/256+45*e6/1024)*Math.sin(4*φ)
    - (35*e6/3072)*Math.sin(6*φ)
  );
  const east  = k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*(e2/(1-e2)))*A**5/120)+E0;
  const north = k0*(M+N*Math.tan(φ)*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*(e2/(1-e2)))*A**6/720));
  return {
    easting:  Math.round(east),
    northing: Math.round(lat < 0 ? north+10000000 : north),
    zone,
    hemi: lat >= 0 ? 'N' : 'S',
  };
}

/* ── GPS BUTTON ──────────────────────────────────────────────── */
(function initGPS() {
  const btn    = document.getElementById('btnGps');
  const accDiv = document.getElementById('utmAcc');
  const accTxt = document.getElementById('utmAccTxt');

  function fillUTM(utm) {
    document.getElementById('valEasting').value  = utm.easting;
    document.getElementById('valNorthing').value = utm.northing;
    document.getElementById('utmZone').value     = utm.zone;
    document.getElementById('utmHemi').value     = utm.hemi;
    document.getElementById('dispEasting').textContent  = utm.easting.toLocaleString() + ' m';
    document.getElementById('dispNorthing').textContent = utm.northing.toLocaleString() + ' m';
    document.getElementById('dispZone').textContent     = `Zona ${utm.zone} ${utm.hemi === 'N' ? '— Norte' : '— Sur'}`;
    ['dispEasting','dispNorthing','dispZone'].forEach(x => document.getElementById(x).classList.remove('empty'));
  }

  function setAcc(m) {
    accDiv.style.display = 'flex';
    const cls = m <= 10 ? 'good' : m <= 50 ? 'fair' : 'poor';
    accDiv.className = 'utm-acc ' + cls;
    accTxt.textContent = `Precisión ${m <= 10 ? 'alta' : m <= 50 ? 'media' : 'baja'} — ±${Math.round(m)} m`;
  }

  if (!navigator.geolocation) {
    btn.disabled = true;
    btn.title = 'GPS no disponible';
    document.getElementById('dispZone').textContent = 'GPS no disponible';
    return;
  }

  btn.addEventListener('click', async () => {
    if (navigator.permissions) {
      try {
        const s = await navigator.permissions.query({ name: 'geolocation' });
        if (s.state === 'denied') {
          showToast('⚠️ Permiso GPS denegado. Actívalo en Ajustes.', true);
          return;
        }
      } catch (_) {}
    }
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> Obteniendo…`;

    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        const utm = toUTM(lat, lng);
        fillUTM(utm);
        setAcc(acc);
        document.getElementById('gpsLat').value = lat.toFixed(7);
        document.getElementById('gpsLng').value = lng.toFixed(7);
        document.getElementById('gpsAcc').value = Math.round(acc);
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg> Actualizar GPS`;
        showToast('📍 Ubicación obtenida ✓');
      },
      err => {
        btn.disabled = false;
        btn.classList.remove('loading');
        btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Reintentar GPS`;
        const msgs = { 1:'Permiso denegado.', 2:'No se pudo obtener ubicación.', 3:'Tiempo agotado.' };
        showToast('GPS: ' + (msgs[err.code] || 'Error desconocido'), true);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });

  window._resetUTM = () => {
    ['valEasting','valNorthing','utmZone','utmHemi','gpsLat','gpsLng','gpsAcc']
      .forEach(x => document.getElementById(x).value = '');
    document.getElementById('dispEasting').textContent  = '— m';
    document.getElementById('dispNorthing').textContent = '— m';
    document.getElementById('dispZone').textContent     = 'Sin datos GPS';
    ['dispEasting','dispNorthing','dispZone'].forEach(x => document.getElementById(x).classList.add('empty'));
    accDiv.style.display = 'none';
    btn.disabled = false;
    btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg> Obtener GPS`;
  };
})();

/* ── CIUDAD DROPDOWN ─────────────────────────────────────────── */
const EC_CITIES = [
  {c:'Cuenca',p:'Azuay'},{c:'Gualaceo',p:'Azuay'},{c:'Paute',p:'Azuay'},{c:'Sigsig',p:'Azuay'},{c:'Chordeleg',p:'Azuay'},{c:'El Pan',p:'Azuay'},{c:'Girón',p:'Azuay'},{c:'Guachapala',p:'Azuay'},{c:'Nabón',p:'Azuay'},{c:'Oña',p:'Azuay'},{c:'Pucará',p:'Azuay'},{c:'San Fernando',p:'Azuay'},{c:'Santa Isabel',p:'Azuay'},{c:'Sevilla de Oro',p:'Azuay'},
  {c:'Guaranda',p:'Bolívar'},{c:'Caluma',p:'Bolívar'},{c:'Chillanes',p:'Bolívar'},{c:'Chimbo',p:'Bolívar'},{c:'Echeandía',p:'Bolívar'},{c:'Las Naves',p:'Bolívar'},{c:'San Miguel',p:'Bolívar'},
  {c:'Azogues',p:'Cañar'},{c:'Biblián',p:'Cañar'},{c:'Cañar',p:'Cañar'},{c:'Deleg',p:'Cañar'},{c:'El Tambo',p:'Cañar'},{c:'La Troncal',p:'Cañar'},{c:'Suscal',p:'Cañar'},
  {c:'Tulcán',p:'Carchi'},{c:'Espejo',p:'Carchi'},{c:'Mira',p:'Carchi'},{c:'Montúfar',p:'Carchi'},{c:'Huaca',p:'Carchi'},
  {c:'Riobamba',p:'Chimborazo'},{c:'Alausí',p:'Chimborazo'},{c:'Chambo',p:'Chimborazo'},{c:'Chunchi',p:'Chimborazo'},{c:'Colta',p:'Chimborazo'},{c:'Cumandá',p:'Chimborazo'},{c:'Guamote',p:'Chimborazo'},{c:'Guano',p:'Chimborazo'},{c:'Pallatanga',p:'Chimborazo'},{c:'Penipe',p:'Chimborazo'},
  {c:'Latacunga',p:'Cotopaxi'},{c:'La Maná',p:'Cotopaxi'},{c:'Pangua',p:'Cotopaxi'},{c:'Pujilí',p:'Cotopaxi'},{c:'Salcedo',p:'Cotopaxi'},{c:'Saquisilí',p:'Cotopaxi'},{c:'Sigchos',p:'Cotopaxi'},
  {c:'Machala',p:'El Oro'},{c:'Arenillas',p:'El Oro'},{c:'Atahualpa',p:'El Oro'},{c:'Balsas',p:'El Oro'},{c:'El Guabo',p:'El Oro'},{c:'Huaquillas',p:'El Oro'},{c:'Las Lajas',p:'El Oro'},{c:'Marcabelí',p:'El Oro'},{c:'Pasaje',p:'El Oro'},{c:'Piñas',p:'El Oro'},{c:'Portovelo',p:'El Oro'},{c:'Santa Rosa',p:'El Oro'},{c:'Zaruma',p:'El Oro'},
  {c:'Esmeraldas',p:'Esmeraldas'},{c:'Atacames',p:'Esmeraldas'},{c:'Eloy Alfaro',p:'Esmeraldas'},{c:'Muisne',p:'Esmeraldas'},{c:'Quinindé',p:'Esmeraldas'},{c:'Rioverde',p:'Esmeraldas'},{c:'San Lorenzo',p:'Esmeraldas'},{c:'Súa',p:'Esmeraldas'},{c:'Tonsupa',p:'Esmeraldas'},
  {c:'Puerto Baquerizo Moreno',p:'Galápagos'},{c:'Puerto Ayora',p:'Galápagos'},{c:'Puerto Villamil',p:'Galápagos'},
  {c:'Guayaquil',p:'Guayas'},{c:'Balao',p:'Guayas'},{c:'Balzar',p:'Guayas'},{c:'Colimes',p:'Guayas'},{c:'Daule',p:'Guayas'},{c:'Durán',p:'Guayas'},{c:'El Empalme',p:'Guayas'},{c:'El Triunfo',p:'Guayas'},{c:'Milagro',p:'Guayas'},{c:'Naranjal',p:'Guayas'},{c:'Naranjito',p:'Guayas'},{c:'Nobol',p:'Guayas'},{c:'Palestina',p:'Guayas'},{c:'Pedro Carbo',p:'Guayas'},{c:'Playas',p:'Guayas'},{c:'Salitre',p:'Guayas'},{c:'Samborondón',p:'Guayas'},{c:'Santa Lucía',p:'Guayas'},{c:'Yaguachi',p:'Guayas'},
  {c:'Ibarra',p:'Imbabura'},{c:'Atuntaqui',p:'Imbabura'},{c:'Cotacachi',p:'Imbabura'},{c:'Otavalo',p:'Imbabura'},{c:'Pimampiro',p:'Imbabura'},{c:'San Miguel de Urcuquí',p:'Imbabura'},
  {c:'Loja',p:'Loja'},{c:'Calvas',p:'Loja'},{c:'Catamayo',p:'Loja'},{c:'Celica',p:'Loja'},{c:'Chaguarpamba',p:'Loja'},{c:'Espíndola',p:'Loja'},{c:'Gonzanamá',p:'Loja'},{c:'Macará',p:'Loja'},{c:'Paltas',p:'Loja'},{c:'Pindal',p:'Loja'},{c:'Puyango',p:'Loja'},{c:'Quilanga',p:'Loja'},{c:'Saraguro',p:'Loja'},{c:'Sozoranga',p:'Loja'},{c:'Zapotillo',p:'Loja'},
  {c:'Babahoyo',p:'Los Ríos'},{c:'Baba',p:'Los Ríos'},{c:'Buena Fe',p:'Los Ríos'},{c:'Mocache',p:'Los Ríos'},{c:'Montalvo',p:'Los Ríos'},{c:'Palenque',p:'Los Ríos'},{c:'Puebloviejo',p:'Los Ríos'},{c:'Quevedo',p:'Los Ríos'},{c:'Urdaneta',p:'Los Ríos'},{c:'Valencia',p:'Los Ríos'},{c:'Ventanas',p:'Los Ríos'},{c:'Vinces',p:'Los Ríos'},
  {c:'Portoviejo',p:'Manabí'},{c:'Chone',p:'Manabí'},{c:'El Carmen',p:'Manabí'},{c:'Flavio Alfaro',p:'Manabí'},{c:'Jama',p:'Manabí'},{c:'Jaramijó',p:'Manabí'},{c:'Jipijapa',p:'Manabí'},{c:'Junín',p:'Manabí'},{c:'Manta',p:'Manabí'},{c:'Montecristi',p:'Manabí'},{c:'Paján',p:'Manabí'},{c:'Pedernales',p:'Manabí'},{c:'Rocafuerte',p:'Manabí'},{c:'San Vicente',p:'Manabí'},{c:'Santa Ana',p:'Manabí'},{c:'Sucre',p:'Manabí'},{c:'Tosagua',p:'Manabí'},
  {c:'Macas',p:'Morona Santiago'},{c:'Gualaquiza',p:'Morona Santiago'},{c:'Huamboya',p:'Morona Santiago'},{c:'Limón Indanza',p:'Morona Santiago'},{c:'Logroño',p:'Morona Santiago'},{c:'Palora',p:'Morona Santiago'},{c:'San Juan Bosco',p:'Morona Santiago'},{c:'Santiago',p:'Morona Santiago'},{c:'Sucúa',p:'Morona Santiago'},{c:'Taisha',p:'Morona Santiago'},{c:'Tiwintza',p:'Morona Santiago'},
  {c:'Tena',p:'Napo'},{c:'Archidona',p:'Napo'},{c:'El Chaco',p:'Napo'},{c:'Quijos',p:'Napo'},
  {c:'Puerto Francisco de Orellana',p:'Orellana'},{c:'Aguarico',p:'Orellana'},{c:'La Joya de los Sachas',p:'Orellana'},{c:'Loreto',p:'Orellana'},
  {c:'Puyo',p:'Pastaza'},{c:'Arajuno',p:'Pastaza'},{c:'Mera',p:'Pastaza'},{c:'Santa Clara',p:'Pastaza'},
  {c:'Quito',p:'Pichincha'},{c:'Cayambe',p:'Pichincha'},{c:'Mejía',p:'Pichincha'},{c:'Pedro Moncayo',p:'Pichincha'},{c:'Pedro Vicente Maldonado',p:'Pichincha'},{c:'Puerto Quito',p:'Pichincha'},{c:'Rumiñahui',p:'Pichincha'},{c:'San Miguel de los Bancos',p:'Pichincha'},{c:'Sangolquí',p:'Pichincha'},{c:'Machachi',p:'Pichincha'},
  {c:'Santa Elena',p:'Santa Elena'},{c:'La Libertad',p:'Santa Elena'},{c:'Salinas',p:'Santa Elena'},{c:'Colonche',p:'Santa Elena'},{c:'Manglaralto',p:'Santa Elena'},
  {c:'Santo Domingo',p:'Sto. Domingo'},{c:'La Concordia',p:'Sto. Domingo'},
  {c:'Nueva Loja (Lago Agrio)',p:'Sucumbíos'},{c:'Cascales',p:'Sucumbíos'},{c:'Cuyabeno',p:'Sucumbíos'},{c:'Gonzalo Pizarro',p:'Sucumbíos'},{c:'Putumayo',p:'Sucumbíos'},{c:'Shushufindi',p:'Sucumbíos'},
  {c:'Ambato',p:'Tungurahua'},{c:'Baños de Agua Santa',p:'Tungurahua'},{c:'Cevallos',p:'Tungurahua'},{c:'Mocha',p:'Tungurahua'},{c:'Patate',p:'Tungurahua'},{c:'Pelileo',p:'Tungurahua'},{c:'Píllaro',p:'Tungurahua'},{c:'Quero',p:'Tungurahua'},{c:'Tisaleo',p:'Tungurahua'},
  {c:'Zamora',p:'Zamora Chinchipe'},{c:'Centinela del Cóndor',p:'Zamora Chinchipe'},{c:'Chinchipe',p:'Zamora Chinchipe'},{c:'El Pangui',p:'Zamora Chinchipe'},{c:'Nangaritza',p:'Zamora Chinchipe'},{c:'Palanda',p:'Zamora Chinchipe'},{c:'Paquisha',p:'Zamora Chinchipe'},{c:'Yacuambi',p:'Zamora Chinchipe'},{c:'Yantzaza',p:'Zamora Chinchipe'},
];

(function initCiudad() {
  const vis  = document.getElementById('ciudadVisible');
  const hid  = document.getElementById('ciudad');
  const drop = document.getElementById('ciudadDropdown');
  const wrap = document.getElementById('ciudadWrap');

  function norm(s) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

  function build(q = '') {
    const nq   = norm(q);
    const hits = EC_CITIES.filter(({ c }) => norm(c).includes(nq));
    if (!hits.length) { drop.innerHTML = `<div class="c-nores">Sin resultados</div>`; return; }
    drop.innerHTML = hits.map(({ c, p }) =>
      `<div class="c-opt" data-v="${c}"><span>${c}</span><span class="ptag">${p}</span></div>`
    ).join('');
    drop.querySelectorAll('.c-opt').forEach(el =>
      el.addEventListener('mousedown', ev => {
        ev.preventDefault();
        vis.value = el.dataset.v;
        hid.value = el.dataset.v;
        vis.classList.remove('err');
        document.getElementById('e-ciudad').classList.remove('show');
        wrap.classList.remove('open');
      })
    );
  }

  vis.addEventListener('focus', () => { build(vis.value); wrap.classList.add('open'); });
  vis.addEventListener('input', () => { hid.value = ''; build(vis.value); wrap.classList.add('open'); });
  vis.addEventListener('blur',  () => {
    setTimeout(() => wrap.classList.remove('open'), 160);
    const m = EC_CITIES.find(({ c }) => norm(c) === norm(vis.value));
    if (m)  { hid.value = m.c; vis.value = m.c; }
    else if (!EC_CITIES.some(({ c }) => c === hid.value)) hid.value = '';
  });

  window._resetCiudad = () => { vis.value = ''; hid.value = ''; };
})();

/* ── PWA: FAVICON + SERVICE WORKER + INSTALL PROMPT ─────────────
   El SW se registra aquí. La lógica de auto-actualización
   está en sw.js (SKIP_WAITING + clients.claim).
   El banner de actualización se muestra cuando hay nueva versión.
   ─────────────────────────────────────────────────────────────── */
(function pwaSetup() {

  // Favicon SVG dinámico
  const svgFav = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7c5cfc"/><stop offset="100%" stop-color="#00e5c0"/>
    </linearGradient></defs>
    <rect width="32" height="32" rx="7" fill="url(#g)"/>
    <text x="16" y="22" font-family="Arial" font-weight="bold" font-size="13"
          text-anchor="middle" fill="white">NX</text></svg>`;
  const link = document.createElement('link');
  link.rel = 'icon'; link.type = 'image/svg+xml';
  link.href = 'data:image/svg+xml,' + encodeURIComponent(svgFav);
  document.head.appendChild(link);

  // ── Service Worker registration + auto-update ──
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });

      // Detectar nueva versión disponible → mostrar banner de actualización
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(newWorker);
          }
        });
      });

      // Controlar recarga cuando el nuevo SW toma control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) { refreshing = true; window.location.reload(); }
      });

      console.log('✅ SW registrado:', reg.scope);
    } catch (e) {
      console.warn('SW error:', e.message);
    }
  });

  // ── Banner de actualización ──
  function showUpdateBanner(worker) {
    const banner = document.getElementById('updateBanner');
    const btn    = document.getElementById('btnUpdate');
    banner.classList.add('show');
    btn.addEventListener('click', () => {
      banner.classList.remove('show');
      // Indicar al nuevo SW que tome control inmediatamente
      worker.postMessage({ type: 'SKIP_WAITING' });
    });
  }

  // ── Install prompt (Android Chrome) ──
  let deferred = null;
  const installBanner = document.getElementById('installBanner');
  const btnInstall    = document.getElementById('btnInstall');
  const btnDismiss    = document.getElementById('btnDismiss');

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    if (!sessionStorage.getItem('ibDismissed'))
      setTimeout(() => installBanner.classList.add('show'), 2500);
  });

  btnInstall.addEventListener('click', async () => {
    if (!deferred) return;
    installBanner.classList.remove('show');
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') showToast('✅ NEXUS instalada correctamente');
    deferred = null;
  });

  btnDismiss.addEventListener('click', () => {
    installBanner.classList.remove('show');
    sessionStorage.setItem('ibDismissed', '1');
  });

  window.addEventListener('appinstalled', () => {
    installBanner.classList.remove('show');
    showToast('✅ App instalada — ábrela desde pantalla de inicio');
  });
})();

/* ── INIT ────────────────────────────────────────────────────── */
(async () => {
  db = await openDB();
  await loadAll();
})();
