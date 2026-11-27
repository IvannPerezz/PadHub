import { padSvg, paint, screenText, variantsFor, PHOTOS, FRONT, frontStage, paintFront } from './pad.js';

const T = window.__TAURI__;
const invoke = T.core.invoke;
const win = T.window.getCurrentWindow();
const $ = (s, r = document) => r.querySelector(s);
const view = $('#view');

// ---------- tema y ventana ----------
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};
document.documentElement.dataset.theme = store.get('theme', 'light');
$('#btn-theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  store.set('theme', t);
};
$('#win-min').onclick = () => win.minimize();
$('#win-max').onclick = () => win.toggleMaximize();
$('#win-close').onclick = () => win.close();
$('#btn-diag').onclick = openDiag;

// ---------- utilidades ----------
const hex = (n) => (n == null ? '—' : n.toString(16).padStart(4, '0').toUpperCase());
const pct = (v) => `${Math.round(v * 100)}%`;

function battery(p, pad) {
  if (p.kind === 'dongle') {
    return `<span class="batt" title="El receptor 2.4G se presenta como un mando con cable y no informa de la batería"><i><b style="width:0"></b></i>Batería: ver en el mando</span>`;
  }
  const level = p.pct ?? (p.kind === 'charged' ? 100 : null);
  const cls = level == null ? '' : level <= 15 ? 'low' : level <= 35 ? 'mid' : '';
  const fill = level == null ? (p.kind === 'wired' ? 100 : 0) : level;
  const label = {
    wired: 'Con cable',
    charging: `Cargando · ${level}%`,
    discharging: `${level}%`,
    charged: 'Cargado',
    unknown: 'Batería n/d',
  }[p.kind];
  return `<span class="batt ${cls}"><i><b style="width:calc(${fill}% - 3px)"></b></i>${label}</span>`;
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// Variante de color elegida para cada mando (se recuerda por VID:PID).
function variantOf(p) {
  const vs = variantsFor(p.model);
  const id = store.get(`variant:${p.key}:${p.model.id}`, '');
  return vs.find((v) => v.id === id) ?? vs[0];
}
const art = (p) => padSvg(p.model, variantOf(p));
// Dibujo neutro para mandos cuyo modelo aún no se sabe.
const GENERIC = { id: 'generic', art: 'generic', brand: '', name: '', body: '#2a2b31', accent: '#9aa0ad' };
// Recursos locales (%APPDATA%\PadHub\recursos): fotos y fuente. Si faltan, se usan
// los dibujos vectoriales y la fuente del sistema.
// Cada recurso llega de Rust como data URL; se guardan en memoria al arrancar.
const RESURL = new Map();
const res = (rel) => (rel ? RESURL.get(rel) ?? null : null);
async function loadResources() {
  let list;
  try { list = await invoke('recursos'); } catch { return; }
  await Promise.all(list.files.map(async (rel) => {
    try {
      const url = await invoke('recurso', { rel });
      if (!url) return;
      if (rel.startsWith('fonts/')) {
        const w = /-(\d{3})\./.exec(rel)?.[1] ?? '400';
        const face = new FontFace('SF Pro Display', `url("${url}")`, { weight: w });
        document.fonts.add(await face.load());
      } else {
        RESURL.set(rel, url);
      }
    } catch (e) {
      console.warn('Recurso', rel, e);
    }
  }));
}
const photoOf = (p) => res(PHOTOS[p.model.id]?.[variantOf(p).id]);
function frontOf(p) {
  const f = FRONT[p.model.id]?.[variantOf(p).id];
  const src = f && res(f.src);
  return src ? { ...f, src } : null;
}
const sigOf = (p) => `${p.model.id}/${variantOf(p).id}`;
const screenBatt = (p) => (p.power.pct != null ? `${p.power.pct}%` : '');

const fullName =(m) => (m.id === 'generic' ? 'Mando genérico' : `${m.brand} ${m.name}`);

// ---------- estado ----------
let pads = [];
let padsSig = '';
let route = { name: 'home' };
let models = [];

async function pollPads() {
  try {
    pads = await invoke('list_pads');
  } catch (e) {
    console.error(e);
  }
  const sig = JSON.stringify(pads.map((p) => [p.id, p.model.id, p.power, p.name, p.needs_confirm, p.assigned]));
  if (sig !== padsSig) {
    padsSig = sig;
    if (route.name === 'device' && !pads.some((p) => p.id === route.id)) route = { name: 'home' };
    if (route.name === 'home') renderHome();
    else updateDeviceMeta();
  }
  const pill = $('#status-pill');
  pill.classList.toggle('hidden', pads.length === 0);
  pill.textContent = pads.length === 1 ? '1 mando conectado' : `${pads.length} mandos conectados`;
}

// ---------- inicio ----------
const cableArt = `
<svg class="empty-art" viewBox="0 0 560 220" fill="none">
  <path d="M-10 40 C120 40 140 120 250 120" stroke="var(--muted)" stroke-opacity=".5" stroke-width="10" stroke-linecap="round"/>
  <rect x="248" y="104" width="58" height="32" rx="8" fill="var(--muted)" fill-opacity=".55"/>
  <rect x="306" y="111" width="26" height="18" rx="3" fill="var(--muted)" fill-opacity=".35"/>
  <path d="M352 120 h40" stroke="var(--muted)" stroke-opacity=".35" stroke-width="2" stroke-dasharray="4 6"/>
  <rect x="404" y="98" width="72" height="44" rx="14" fill="none" stroke="var(--muted)" stroke-opacity=".4" stroke-width="2" stroke-dasharray="5 5"/>
</svg>`;

function renderHome() {
  route = { name: 'home' };
  if (!pads.length) {
    view.innerHTML = `
      <section class="home">
        ${cableArt}
        <h1>Conecta un mando</h1>
        <p class="sub">Por cable, con su receptor 2.4G o por Bluetooth. Se detecta solo.</p>
        <button class="pill dark btn big" id="help" style="margin-top:14px">+ ¿Cómo lo conecto?</button>
      </section>`;
    $('#help').onclick = openDiag;
    return;
  }
  view.innerHTML = `
    <section class="home">
      <div class="carousel">
        ${pads.map((p, i) => `
          <article class="card" data-id="${p.id}" style="animation-delay:${i * 70}ms">
            ${p.needs_confirm ? `
            ${padSvg(GENERIC)}
            <div class="brand">Receptor 2.4G genérico</div>
            <div class="mname">¿Qué mando es?</div>
            <div class="chips">
              ${models.filter((m) => m.id !== 'machenike-generic').map((m) => `<button class="pill ghost btn chip" data-assign="${m.id}">${m.brand} ${m.name}</button>`).join('')}
            </div>` : `
            ${photoOf(p) ? `<div class="photo"><img src="${photoOf(p)}" alt="" draggable="false"></div>` : art(p)}
            <div class="brand">${p.model.brand}</div>
            <div class="mname">${p.model.id === 'generic' ? esc(p.name) : p.model.name}</div>
            <div class="swatches" data-sw="${p.id}"></div>`}
            <div class="row">
              <span class="pill">${battery(p.power, p)}</span>
              <button class="pill dark btn">Entrar  →</button>
            </div>
            ${p.identified ? '' : `<span class="tag" style="margin-top:6px">Sin identificar · ${hex(p.vid)}:${hex(p.pid)}</span>`}
          </article>`).join('')}
      </div>
    </section>`;
  view.querySelectorAll('.card').forEach((c) => (c.onclick = () => openDevice(+c.dataset.id)));
  view.querySelectorAll('[data-assign]').forEach((b) => (b.onclick = async (e) => {
    e.stopPropagation();
    const p = pads.find((x) => x.id === +b.closest('.card').dataset.id);
    await invoke('assign_model', { key: p.key, model: b.dataset.assign });
    padsSig = '';
    pollPads();
  }));
  pads.forEach((p) => {
    const svg = view.querySelector(`.card[data-id="${p.id}"] .pad`);
    screenText(svg, 'PADHUB', screenBatt(p));
    renderSwatches(p, view.querySelector(`.swatches[data-sw="${p.id}"]`), renderHome);
  });
}

// ---------- vista de mando ----------
const dev = {
  tab: 'sticks',
  dz: { inner: 0.08, outer: 0.98 },
  trail: { ls: [], rs: [] },
  circ: null, // {ls: Float32Array, rs: Float32Array}
  drift: null, // {until, max:{ls,rs}}
  trig: { lt: new Set(), rt: new Set(), max: { lt: 0, rt: 0 } },
  seen: new Set(),
  rumble: 0.6,
};

function resetDev() {
  dev.trail = { ls: [], rs: [] };
  dev.circ = null;
  dev.drift = null;
  dev.trig = { lt: new Set(), rt: new Set(), max: { lt: 0, rt: 0 } };
  dev.seen = new Set();
  dev.tab = 'sticks';
}

function openDevice(id) {
  route = { name: 'device', id };
  resetDev();
  const p = pads.find((x) => x.id === id);
  view.innerHTML = `
    <section class="device">
      <div class="stage">
        <button class="pill ghost btn back" id="back">←  Mandos</button>
        <div id="dev-svg"></div>
        <div class="title">
          <div class="brand" id="dev-brand"></div>
          <div class="mname" id="dev-name"></div>
        </div>
        <div class="meta" id="dev-meta"></div>
        <div class="swatches" id="dev-colors"></div>
      </div>
      <div class="panel">
        <div class="tabs" id="tabs"></div>
        <div class="pane" id="pane"></div>
      </div>
    </section>`;
  $('#back').onclick = renderHome;
  updateDeviceMeta();
  renderTab();
}

function current() {
  return pads.find((p) => p.id === route.id);
}

function updateDeviceMeta() {
  const p = current();
  if (!p || !$('#dev-name')) return;
  $('#dev-brand').textContent = p.model.brand;
  $('#dev-name').textContent = p.model.id === 'generic' ? p.name : p.model.name;
  $('#dev-meta').innerHTML = `
    <span class="pill">${battery(p.power, p)}</span>
    <span class="pill">${p.vid != null ? `${hex(p.vid)}:${hex(p.pid)}` : p.os_name}</span>`;
  const box = $('#dev-svg');
  if (box.dataset.sig !== sigOf(p)) {
    const f = frontOf(p);
    box.innerHTML = f ? frontStage(f) : art(p);
    box.dataset.sig = sigOf(p);
  }
  screenText($('#dev-svg .pad'), 'PADHUB', screenBatt(p));
  renderSwatches(p);
  renderTabs();
  if (dev.tab === 'info') renderTab();
}

// Muestras de color bajo el mando (como el selector de color del ATK Hub).
function renderSwatches(p, box = $('#dev-colors'), after = updateDeviceMeta) {
  const vs = variantsFor(p.model);
  if (!box) return;
  if (vs.length < 2) { box.innerHTML = ''; return; }
  const cur = variantOf(p).id;
  box.innerHTML = vs
    .map((v) => `<button class="sw ${v.id === cur ? 'on' : ''}" data-v="${v.id}" title="${v.label}" style="--sw:${v.body}"><i></i></button>`)
    .join('') + `<span class="sw-label">${variantOf(p).label}</span>`;
  box.querySelectorAll('.sw').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    store.set(`variant:${p.key}:${p.model.id}`, b.dataset.v);
    after();
  }));
}

function renderTabs() {
  const p = current();
  const tabs = [
    ['sticks', 'Sticks'],
    ['trig', 'Gatillos'],
    ['btn', 'Botones'],
    ['rumble', 'Vibración'],
    ['info', 'Info'],
  ];
  if (p.model.brand === 'Machenike') tabs.push(['config', 'Configuración']);
  const el = $('#tabs');
  const sig = tabs.map((t) => t[0]).join();
  // Solo se reconstruye si cambian las pestañas; así la pastilla se desliza en vez de saltar.
  if (el.dataset.sig !== sig) {
    el.dataset.sig = sig;
    el.innerHTML = '<span class="seg-thumb"></span>' + tabs
      .map(([k, l]) => `<button class="tab" data-t="${k}">${l}</button>`)
      .join('');
    el.querySelectorAll('.tab').forEach((b) => (b.onpointerdown = () => {
      if (dev.tab === b.dataset.t) return;
      dev.tab = b.dataset.t;
      renderTabs();
      renderTab();
    }));
  }
  el.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.t === dev.tab));
  const on = el.querySelector('.tab.on');
  const thumb = el.querySelector('.seg-thumb');
  if (on && thumb) {
    thumb.style.width = `${on.offsetWidth}px`;
    thumb.style.transform = `translateX(${on.offsetLeft}px)`;
  }
}

// Relleno de los deslizadores (parte recorrida en color de acento).
function fillRange(r) {
  const p = ((r.value - r.min) / (r.max - r.min)) * 100;
  r.style.setProperty('--p', `${p}%`);
}
document.addEventListener('input', (e) => { if (e.target.matches?.('input[type="range"]')) fillRange(e.target); });

function renderTab() {
  const p = current();
  const pane = $('#pane');
  if (!pane || !p) return;
  if (dev.tab === 'sticks') {
    pane.innerHTML = `
      <div class="sec">
        <h3>Posición en directo</h3>
        <div class="box sticks">
          ${['ls', 'rs'].map((k) => `
            <div class="stickbox">
              <canvas id="cv-${k}" width="400" height="400"></canvas>
              <div class="readout num">${k === 'ls' ? 'Izq.' : 'Der.'} · X <b id="${k}-x">0</b> Y <b id="${k}-y">0</b> R <b id="${k}-r">0</b></div>
            </div>`).join('')}
        </div>
        <p class="hint">Punto gris: señal cruda del mando. Punto de color: lo que saldría con la zona muerta de abajo aplicada.</p>
      </div>
      <div class="sec">
        <h3>Probar zona muerta</h3>
        <div class="box" style="display:flex;flex-direction:column;gap:12px">
          <label class="slider">Interior<input type="range" id="dz-in" min="0" max="0.4" step="0.01" value="${dev.dz.inner}"><output id="dz-in-o">${pct(dev.dz.inner)}</output></label>
          <label class="slider">Exterior<input type="range" id="dz-out" min="0.6" max="1" step="0.01" value="${dev.dz.outer}"><output id="dz-out-o">${pct(dev.dz.outer)}</output></label>
          ${p.model.id === 'manba-one-v2' ? '<p class="hint">Esto es solo una simulación para encontrar tu valor: en el Manba la zona muerta real se cambia desde su pantalla.</p>' : ''}
        </div>
      </div>
      <div class="sec">
        <h3>Pruebas</h3>
        <div class="actions">
          <button class="pill dark btn" id="t-drift">Medir drift (3 s)</button>
          <button class="pill ghost btn" id="t-circ">${dev.circ ? 'Parar test de circularidad' : 'Test de circularidad'}</button>
        </div>
        <div class="result hidden" id="res"></div>
      </div>`;
    $('#dz-in').oninput = (e) => { dev.dz.inner = +e.target.value; $('#dz-in-o').textContent = pct(dev.dz.inner); };
    $('#dz-out').oninput = (e) => { dev.dz.outer = +e.target.value; $('#dz-out-o').textContent = pct(dev.dz.outer); };
    $('#t-drift').onclick = () => {
      dev.drift = { until: performance.now() + 3000, max: { ls: 0, rs: 0 } };
      showRes('Suelta los dos sticks y no toques el mando…');
    };
    $('#t-circ').onclick = () => {
      if (dev.circ) {
        const r = circResult();
        dev.circ = null;
        renderTab();
        showRes(r);
      } else {
        dev.circ = { ls: new Float32Array(72), rs: new Float32Array(72) };
        renderTab();
        showRes('Gira cada stick despacio pegado al borde, varias vueltas. Luego pulsa “Parar”.');
      }
    };
  } else if (dev.tab === 'trig') {
    pane.innerHTML = `
      <div class="sec">
        <h3>Recorrido</h3>
        <div class="box trigs">
          ${['lt', 'rt'].map((k) => `
            <div class="trigbar">
              <div class="bar-v"><i id="${k}-bar"></i></div>
              <div class="big num" id="${k}-v">0%</div>
              <div class="hint num">${k.toUpperCase()} · máx <b id="${k}-max">0%</b> · <b id="${k}-res">0</b> niveles</div>
            </div>`).join('')}
        </div>
        <p class="hint">Aprieta cada gatillo despacio hasta el fondo. “Niveles” cuenta los valores distintos que manda el mando: cuantos más, más fino el gatillo. Si el máximo no llega a 100%, el gatillo no alcanza el final de su recorrido.</p>
        <div class="actions"><button class="pill ghost btn" id="trig-reset">Reiniciar medición</button></div>
      </div>`;
    $('#trig-reset').onclick = () => { dev.trig = { lt: new Set(), rt: new Set(), max: { lt: 0, rt: 0 } }; };
  } else if (dev.tab === 'btn') {
    const names = [['a','A'],['b','B'],['x','X'],['y','Y'],['lb','LB'],['rb','RB'],['l3','L3'],['r3','R3'],['up','↑'],['down','↓'],['left','←'],['right','→'],['view','View'],['menu','Menu'],['home','Home'],['c','C'],['z','Z']];
    pane.innerHTML = `
      <div class="sec">
        <h3>Test de botones</h3>
        <div class="btngrid">${names.map(([k, l]) => `<div class="bt ${dev.seen.has(k) ? 'seen' : ''}" data-k="${k}">${l}</div>`).join('')}</div>
        <p class="hint">Pulsa todos los botones: el punto verde marca los que ya han respondido. Los traseros (paletas) normalmente no llegan a Windows como botones propios: el mando los convierte en el botón que tengan asignado.</p>
        <div class="actions"><button class="pill ghost btn" id="btn-reset">Reiniciar</button></div>
      </div>`;
    $('#btn-reset').onclick = () => { dev.seen.clear(); renderTab(); };
  } else if (dev.tab === 'rumble') {
    pane.innerHTML = `
      <div class="sec">
        <h3>Motores de vibración</h3>
        ${p.rumble ? `
        <div class="box" style="display:flex;flex-direction:column;gap:14px">
          <label class="slider">Intensidad<input type="range" id="rb-int" min="0.1" max="1" step="0.05" value="${dev.rumble}"><output id="rb-o">${pct(dev.rumble)}</output></label>
          <div class="actions">
            <button class="pill dark btn" data-r="strong">Motor izquierdo (fuerte)</button>
            <button class="pill dark btn" data-r="weak">Motor derecho (suave)</button>
            <button class="pill ghost btn" data-r="both">Los dos</button>
          </div>
        </div>` : '<div class="result">Windows dice que este mando no acepta vibración en el modo actual.</div>'}
      </div>`;
    if (p.rumble) {
      $('#rb-int').oninput = (e) => { dev.rumble = +e.target.value; $('#rb-o').textContent = pct(dev.rumble); };
      pane.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => {
        const m = Math.round(65535 * dev.rumble);
        const r = b.dataset.r;
        invoke('rumble', { id: p.id, strong: r !== 'weak' ? m : 0, weak: r !== 'strong' ? m : 0, ms: 700 });
      }));
    }
  } else if (dev.tab === 'info') {
    pane.innerHTML = `
      <div class="sec">
        <h3>Modelo</h3>
        <div class="box" style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;gap:10px;align-items:center">
            <select id="assign">
              <option value="">Automático${p.assigned ? '' : ` (${fullName(p.model)})`}</option>
              ${models.map((m) => `<option value="${m.id}" ${p.assigned && p.model.id === m.id ? 'selected' : ''}>${m.brand} ${m.name}</option>`).join('')}
            </select>
            <span class="hint">${p.how ? esc(p.how) : 'No reconocido'}</span>
          </div>
          <p class="hint">${p.model.support}</p>
        </div>
      </div>
      <div class="sec">
        <h3>Dispositivo</h3>
        <dl class="box kv">
          <dt>Nombre (Windows)</dt><dd>${esc(p.os_name) || '—'}</dd>
          <dt>Nombre (mapeo)</dt><dd>${esc(p.name)}</dd>
          <dt>VID : PID</dt><dd class="mono">${hex(p.vid)} : ${hex(p.pid)}</dd>
          <dt>Mismo puerto USB</dt><dd class="mono">${esc(p.siblings.join(' · ')) || '—'}</dd>
          <dt>Cadenas HID</dt><dd>${esc(p.hid_strings.join(' · ')) || '—'}</dd>
          <dt>Mapeo</dt><dd>${{ driver: 'XInput (gamepad)', other: 'XInput (otro tipo)' }[p.mapping] ?? p.mapping}</dd>
          <dt>Batería</dt><dd>${battery(p.power, p)}</dd>
          <dt>Vibración</dt><dd>${p.rumble ? 'Sí' : 'No'}</dd>
          <dt>Versión de producto</dt><dd class="mono">${p.product_version != null ? `0x${p.product_version.toString(16).padStart(4, '0').toUpperCase()}` : '—'}</dd>
        </dl>
      </div>
      <div class="sec">
        <h3>Soporte</h3>
        <div class="box" style="display:flex;flex-direction:column;gap:10px">
          <p class="hint">Copia un informe técnico de este mando (identificadores, receptor y sus interfaces USB) para mandarlo y mejorar la detección. No incluye datos personales.</p>
          <div class="actions"><button class="pill dark btn" id="copy-report">Copiar informe</button></div>
        </div>
      </div>`;
    $('#copy-report').onclick = async (e) => {
      const btn = e.currentTarget;
      try {
        await navigator.clipboard.writeText(await buildReport(p));
        btn.textContent = 'Copiado ✓';
      } catch (err) {
        btn.textContent = 'No se pudo copiar';
      }
      setTimeout(() => (btn.textContent = 'Copiar informe'), 2000);
    };
    $('#assign').onchange = async (e) => {
      await invoke('assign_model', { key: p.key, model: e.target.value || null });
      padsSig = '';
      pollPads();
    };
  } else if (dev.tab === 'config') {
    pane.innerHTML = `
      <div class="sec locked">
        <h3>Configuración guardada en el mando</h3>
        <div class="box" style="display:flex;flex-direction:column;gap:12px">
          <span class="lock">🔒 Pendiente del protocolo Keylinker</span>
          <p class="hint">Remapeo, zona muerta, curvas de sticks y gatillos, y vibración, escritos directamente en la memoria del mando. Para activarlo hace falta capturar lo que manda la app Keylinker del móvil al mando (registro HCI de Bluetooth en Android). Ver <b>GUIA-KEYLINKER.md</b> en la carpeta del proyecto.</p>
        </div>
      </div>`;
  }
}

// Tras pintar una pestaña, colorear la parte recorrida de sus deslizadores.
const _renderTab = renderTab;
renderTab = function () {
  _renderTab();
  document.querySelectorAll('#pane input[type="range"]').forEach(fillRange);
};

// Informe técnico para identificar receptores (sin rutas ni nombres de usuario).
async function buildReport(p) {
  let hid = [];
  try { hid = await invoke('hid_devices'); } catch {}
  const ids = new Set([`${hex(p.vid)}:${hex(p.pid)}`, ...p.siblings]);
  const rel = hid
    .filter((h) => ids.has(`${hex(h.vid)}:${hex(h.pid)}`))
    .map((h) => ({ id: `${hex(h.vid)}:${hex(h.pid)}`, iface: h.interface, usage: `0x${h.usage_page.toString(16)}:0x${h.usage.toString(16)}`, fabricante: h.manufacturer, producto: h.product }));
  let version = '';
  try { version = await invoke('app_version'); } catch {}
  return JSON.stringify({
    padhub: version,
    modelo_mostrado: `${p.model.brand} ${p.model.name}`,
    como: p.how,
    asignado: p.assigned,
    vid_pid: `${hex(p.vid)}:${hex(p.pid)}`,
    version_producto: p.product_version,
    mismo_puerto: p.siblings,
    nombre_windows: p.os_name,
    cadenas_hid: p.hid_strings,
    bateria: p.power,
    vibracion: p.rumble,
    interfaces_hid: rel,
  }, null, 2);
}

function showRes(html) {
  const r = $('#res');
  if (!r) return;
  r.classList.remove('hidden');
  r.innerHTML = html;
}

function circResult() {
  const out = [];
  for (const k of ['ls', 'rs']) {
    const b = Array.from(dev.circ[k]).filter((v) => v > 0.5);
    if (b.length < 54) { out.push(`${k === 'ls' ? 'Izquierdo' : 'Derecho'}: vueltas incompletas`); continue; }
    const err = b.reduce((s, v) => s + Math.abs(v - 1), 0) / b.length;
    out.push(`${k === 'ls' ? 'Izquierdo' : 'Derecho'}: error medio <b>${(err * 100).toFixed(1)}%</b>`);
  }
  return out.join(' · ') + '<br><span class="hint">Menos de un 5% es muy bueno. Los mandos con sticks Hall suelen quedarse por debajo del 8%.</span>';
}

// ---------- canvas de stick ----------
function applyDz(x, y) {
  const r = Math.hypot(x, y);
  if (r < dev.dz.inner || r === 0) return [0, 0];
  const n = Math.min(1, (r - dev.dz.inner) / (dev.dz.outer - dev.dz.inner));
  return [(x / r) * n, (y / r) * n];
}

function cssVar(n) {
  return getComputedStyle(document.documentElement).getPropertyValue(n).trim();
}

function drawStick(cv, k, x, y, accent) {
  const g = cv.getContext('2d');
  const W = cv.width, c = W / 2, R = W / 2 - 14;
  const text = cssVar('--text'), muted = cssVar('--muted'), line = cssVar('--line');
  g.clearRect(0, 0, W, W);
  // zonas
  g.fillStyle = line;
  g.beginPath(); g.arc(c, c, R, 0, 7); g.fill();
  g.globalAlpha = 0.5;
  g.strokeStyle = muted; g.lineWidth = 1;
  g.beginPath(); g.moveTo(c - R, c); g.lineTo(c + R, c); g.moveTo(c, c - R); g.lineTo(c, c + R); g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = accent + '33';
  g.beginPath(); g.arc(c, c, R * dev.dz.inner, 0, 7); g.fill();
  g.setLineDash([6, 6]); g.strokeStyle = accent;
  g.beginPath(); g.arc(c, c, R * dev.dz.outer, 0, 7); g.stroke();
  g.setLineDash([]);
  // circularidad
  if (dev.circ) {
    const b = dev.circ[k];
    g.strokeStyle = text; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = ((i % 72) / 72) * Math.PI * 2, r = b[i % 72];
      const px = c + Math.cos(a) * r * R, py = c - Math.sin(a) * r * R;
      i ? g.lineTo(px, py) : g.moveTo(px, py);
    }
    g.stroke();
  }
  // estela
  const tr = dev.trail[k];
  tr.forEach(([tx, ty], i) => {
    g.fillStyle = muted; g.globalAlpha = (i / tr.length) * 0.35;
    g.beginPath(); g.arc(c + tx * R, c - ty * R, 4, 0, 7); g.fill();
  });
  g.globalAlpha = 1;
  // crudo y procesado
  g.fillStyle = muted;
  g.beginPath(); g.arc(c + x * R, c - y * R, 9, 0, 7); g.fill();
  const [ox, oy] = applyDz(x, y);
  g.fillStyle = accent;
  g.beginPath(); g.arc(c + ox * R, c - oy * R, 11, 0, 7); g.fill();
  g.strokeStyle = cssVar('--surface2'); g.lineWidth = 3; g.stroke();
}

// ---------- bucle en vivo ----------
async function frame() {
  try {
    if (route.name === 'device') await liveDevice();
    else if (route.name === 'home' && pads.length) await liveHome();
  } catch (e) {
    console.error(e);
  }
  requestAnimationFrame(frame);
}

async function liveHome() {
  for (const p of pads) {
    const s = await invoke('pad_live', { id: p.id });
    paint(view.querySelector(`.card[data-id="${p.id}"] .pad`), s);
  }
}

async function liveDevice() {
  const p = current();
  if (!p) return;
  const s = await invoke('pad_live', { id: p.id });
  if (!s) return;
  paint($('#dev-svg .pad'), s);
  paintFront($('#dev-svg .front'), s);
  Object.keys(s.buttons).forEach((b) => dev.seen.add(b));
  for (const k of ['ls', 'rs']) {
    const [x, y] = s[k];
    const r = Math.hypot(x, y);
    const tr = dev.trail[k];
    tr.push([x, y]);
    if (tr.length > 36) tr.shift();
    if (dev.circ && r > 0.3) {
      let i = Math.round(((Math.atan2(y, x) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * 72) % 72;
      dev.circ[k][i] = Math.max(dev.circ[k][i], Math.min(r, 1.5));
    }
    if (dev.drift) dev.drift.max[k] = Math.max(dev.drift.max[k], r);
    const cv = $(`#cv-${k}`);
    if (cv) {
      drawStick(cv, k, x, y, cssVar('--accent'));
      $(`#${k}-x`).textContent = x.toFixed(3);
      $(`#${k}-y`).textContent = y.toFixed(3);
      $(`#${k}-r`).textContent = r.toFixed(3);
    }
  }
  if (dev.drift && performance.now() > dev.drift.until) {
    const m = dev.drift.max;
    const rec = (v) => Math.min(30, Math.ceil(v * 100) + 2);
    showRes(`Drift en reposo: izquierdo <b>${(m.ls * 100).toFixed(1)}%</b>, derecho <b>${(m.rs * 100).toFixed(1)}%</b>.<br>
      Zona muerta mínima recomendada: <b>${rec(m.ls)}%</b> / <b>${rec(m.rs)}%</b>.`);
    dev.drift = null;
  }

  for (const k of ['lt', 'rt']) {
    const v = s[k];
    dev.trig[k].add(Math.round(v * 4096));
    dev.trig.max[k] = Math.max(dev.trig.max[k], v);
    const bar = $(`#${k}-bar`);
    if (bar) {
      bar.style.height = pct(v);
      $(`#${k}-v`).textContent = pct(v);
      $(`#${k}-max`).textContent = pct(dev.trig.max[k]);
      $(`#${k}-res`).textContent = dev.trig[k].size;
    }
  }

  document.querySelectorAll('.bt').forEach((el) => {
    const k = el.dataset.k;
    el.classList.toggle('on', !!s.buttons[k]);
    el.classList.toggle('seen', dev.seen.has(k));
  });
}

// ---------- diagnóstico ----------
async function openDiag() {
  const sheet = $('#sheet');
  sheet.classList.remove('hidden');
  sheet.innerHTML = `<div class="top"><h2>Diagnóstico HID</h2>
    <button class="pill ghost btn" id="d-copy">Copiar</button>
    <button class="pill dark btn" id="d-close">Cerrar</button></div>
    <p class="hint">Todas las interfaces HID del PC. En naranja, las que coinciden con un mando conectado. Si un mando no aparece en la pantalla principal pero sí aquí, pásame esta lista.</p>
    <div class="tbl"><table><thead><tr><th>VID:PID</th><th>Interfaz</th><th>Uso</th><th>Fabricante</th><th>Producto</th></tr></thead><tbody id="d-body"><tr><td>Cargando…</td></tr></tbody></table></div>`;
  $('#d-close').onclick = () => sheet.classList.add('hidden');
  let rows = [];
  try { rows = await invoke('hid_devices'); } catch (e) { $('#d-body').innerHTML = `<tr><td>${e}</td></tr>`; return; }
  const padIds = new Set(pads.map((p) => `${hex(p.vid)}:${hex(p.pid)}`));
  const usage = (r) => {
    const n = { '1:4': 'Joystick', '1:5': 'Gamepad', '1:2': 'Ratón', '1:6': 'Teclado', '12:1': 'Consumo' }[`${r.usage_page}:${r.usage}`];
    return n ?? (r.usage_page >= 0xff00 ? `Fabricante 0x${r.usage_page.toString(16)}:${r.usage}` : `0x${r.usage_page.toString(16)}:${r.usage}`);
  };
  $('#d-body').innerHTML = rows.map((r) => {
    const id = `${hex(r.vid)}:${hex(r.pid)}`;
    return `<tr class="${padIds.has(id) ? 'pad-row' : ''}"><td class="mono">${id}</td><td>${r.interface}</td><td>${usage(r)}</td><td>${esc(r.manufacturer) || '—'}</td><td>${esc(r.product) || '—'}</td></tr>`;
  }).join('');
  $('#d-copy').onclick = () => navigator.clipboard.writeText(rows.map((r) => `${hex(r.vid)}:${hex(r.pid)} if${r.interface} ${usage(r)} | ${r.manufacturer ?? ''} | ${r.product ?? ''}`).join('\n'));
}

// ---------- actualizaciones ----------
const upd = { info: null, busy: false };

async function checkUpdate() {
  if (upd.busy) return;
  try {
    upd.info = await invoke('check_update');
  } catch (e) {
    console.warn('Actualización:', e);
    upd.info = null;
  }
  $('#upd-pill').classList.toggle('hidden', !upd.info);
}

function openUpdate() {
  if (!upd.info) return;
  $('#upd-ver').textContent = `Versión ${upd.info.version} · tienes la ${upd.info.current}`;
  $('#upd-notes').textContent = upd.info.notes ?? '';
  $('#upd-prog').classList.add('hidden');
  $('#upd-status').classList.add('hidden');
  $('#upd-actions').classList.remove('hidden');
  $('#upd-scrim').classList.remove('hidden');
  const pop = $('#upd-pop');
  pop.classList.remove('hidden', 'closing');
}

function closeUpdate() {
  if (upd.busy) return;
  const pop = $('#upd-pop');
  pop.classList.add('closing');
  $('#upd-scrim').classList.add('hidden');
  pop.addEventListener('animationend', () => pop.classList.add('hidden'), { once: true });
}

async function runUpdate() {
  upd.busy = true;
  $('#upd-actions').classList.add('hidden');
  $('#upd-prog').classList.remove('hidden');
  const status = $('#upd-status');
  status.classList.remove('hidden');
  status.textContent = 'Descargando…';
  const unlisten = await T.event.listen('update-progress', ({ payload: [done, total] }) => {
    const pct = total ? Math.min(100, (done / total) * 100) : 0;
    $('#upd-bar').style.width = `${pct}%`;
    const mb = (n) => (n / 1048576).toFixed(1);
    status.textContent = total ? `Descargando… ${mb(done)} de ${mb(total)} MB` : `Descargando… ${mb(done)} MB`;
    if (total && done >= total) status.textContent = 'Instalando y reiniciando…';
  });
  try {
    await invoke('install_update'); // al terminar, la app se reinicia sola
  } catch (e) {
    unlisten();
    upd.busy = false;
    status.textContent = `No se pudo actualizar: ${e}`;
    $('#upd-actions').classList.remove('hidden');
  }
}

$('#upd-pill').onclick = openUpdate;
$('#upd-later').onclick = closeUpdate;
$('#upd-scrim').onclick = closeUpdate;
$('#upd-go').onclick = runUpdate;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeUpdate(); });

// ---------- arranque ----------
(async () => {
  await loadResources();
  try { models = await invoke('models'); } catch {}
  checkUpdate();
  setInterval(checkUpdate, 30 * 60 * 1000);
  await pollPads();
  renderHome();
  setInterval(pollPads, 1000);
  requestAnimationFrame(frame);
})();
