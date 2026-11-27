// Ilustraciones vectoriales propias de cada mando (sin fotos ni logotipos de
// las marcas). Cada modelo tiene su silueta, su distribución de botones y sus
// detalles; los colores salen de la variante elegida.

// ---------- variantes de color ----------
export const VARIANTS = {
  'manba-one-v2': [
    { id: 'blanco', label: 'Blanco', body: '#eceef2', edge: '#c9ccd3', btn: '#f8f9fb', btnText: '#aab0bb', cap: '#f4f5f7', capRing: '#d5d8de', accent: '#7c5cff', screen: true },
    { id: 'negro', label: 'Negro', body: '#34353b', edge: '#18191c', btn: '#1b1c20', btnText: '#6d717b', cap: '#1e1f23', capRing: '#4a4c54', accent: '#7c5cff', screen: true },
  ],
  'machenike-g5-pro': [
    { id: 'blanco', label: 'Blanco', body: '#eef0f3', edge: '#cfd3da', btn: '#16171a', btnText: '#e9eaee', cap: '#1d1e22', capRing: '#3a3c42', accent: '#22c3ee' },
    { id: 'negro', label: 'Negro', body: '#25262b', edge: '#141518', btn: '#111215', btnText: '#cfd2d8', cap: '#1a1b1f', capRing: '#3a3c42', accent: '#22c3ee' },
  ],
  'machenike-g3-v2': [
    { id: 'azul', label: 'Azul translúcido', body: '#1f5fb8', edge: '#0e2f63', btn: '#141a24', btnText: '#8c909a', cap: '#18191c', capRing: '#2e3036', accent: '#8b5cf6' },
    { id: 'negro', label: 'Negro', body: '#1f2024', edge: '#0f1012', btn: '#141518', btnText: '#8c909a', cap: '#18191c', capRing: '#2e3036', accent: '#8b5cf6' },
  ],
};

// Fotos (aportadas por el usuario, fondo recortado) para la pantalla de inicio.
export const PHOTOS = {
  'manba-one-v2': { blanco: 'img/manba-blanco.webp', negro: 'img/manba-negro.webp' },
  'machenike-g3-v2': { azul: 'img/g3-azul.webp', negro: 'img/g3-negro.webp' },
};

// Fotos frontales para la vista de detalle, con la posición (en fracción del
// ancho/alto de la imagen) de cada control para iluminarlo en directo.
const MANBA_MARKS = {
  blanco: {
    ls: [0.194, 0.26], rs: [0.624, 0.465], dpad: [0.336, 0.482], arm: [0.043, 0.058],
    y: [0.793, 0.219], x: [0.731, 0.296], b: [0.857, 0.296], a: [0.793, 0.373],
    view: [0.355, 0.656], cap: [0.447, 0.656], home: [0.548, 0.656], menu: [0.642, 0.656],
    lb: [0.2, 0.068], rb: [0.8, 0.068],
  },
  negro: {
    ls: [0.2, 0.258], rs: [0.622, 0.456], dpad: [0.358, 0.483], arm: [0.05, 0.068],
    y: [0.796, 0.202], x: [0.733, 0.289], b: [0.858, 0.289], a: [0.796, 0.372],
    view: [0.353, 0.657], cap: [0.444, 0.657], home: [0.542, 0.657], menu: [0.642, 0.657],
    lb: [0.189, 0.076], rb: [0.811, 0.076],
  },
};
// G3 V2: View, Home y Menú son botones redondos (round: true).
const G3_MARKS = {
  azul: {
    ls: [0.253, 0.284], rs: [0.624, 0.49], dpad: [0.367, 0.507], arm: [0.053, 0.077],
    y: [0.753, 0.177], x: [0.688, 0.271], b: [0.818, 0.271], a: [0.753, 0.369],
    view: [0.421, 0.254], home: [0.5, 0.137], menu: [0.574, 0.254],
    lb: [0.247, 0.03], rb: [0.753, 0.03], round: true,
  },
  negro: {
    ls: [0.249, 0.286], rs: [0.622, 0.484], dpad: [0.367, 0.492], arm: [0.051, 0.075],
    y: [0.753, 0.183], x: [0.683, 0.273], b: [0.816, 0.273], a: [0.753, 0.37],
    view: [0.422, 0.254], home: [0.5, 0.132], menu: [0.571, 0.254],
    lb: [0.249, 0.043], rb: [0.751, 0.043], round: true,
  },
};
export const FRONT = {
  'manba-one-v2': {
    blanco: { src: 'img/front-blanco.webp', ratio: 1157 / 848, marks: MANBA_MARKS.blanco },
    negro: { src: 'img/front-negro.webp', ratio: 1171 / 858, marks: MANBA_MARKS.negro },
  },
  'machenike-g3-v2': {
    azul: { src: 'img/g3-front-azul.webp', ratio: 850 / 582, marks: G3_MARKS.azul },
    negro: { src: 'img/g3-front-negro.webp', ratio: 918 / 630, marks: G3_MARKS.negro },
  },
};

/** Foto frontal con capas de luz para cada control. */
export function frontStage(f) {
  const m = f.marks;
  const pos = ([x, y]) => `left:${x * 100}%;top:${y * 100}%`;
  const dot = (b, p, cls = '') => `<i class="hl ${cls}" data-b="${b}" style="${pos(p)}"></i>`;
  const [dx, dy] = m.dpad, [ax, ay] = m.arm;
  return `
  <div class="front" style="aspect-ratio:${f.ratio}">
    <img src="${f.src}" alt="" draggable="false">
    ${dot('lb', m.lb, 'bar')}${dot('rb', m.rb, 'bar')}
    <i class="trig-glow" data-t="lt" style="${pos(m.lb)}"></i><i class="trig-glow" data-t="rt" style="${pos(m.rb)}"></i>
    ${dot('y', m.y)}${dot('x', m.x)}${dot('b', m.b)}${dot('a', m.a)}
    ${dot('up', [dx, dy - ay], 'sq')}${dot('down', [dx, dy + ay], 'sq')}${dot('left', [dx - ax, dy], 'sq')}${dot('right', [dx + ax, dy], 'sq')}
    ${dot('view', m.view, m.round ? '' : 'pill')}${dot('home', m.home, m.round ? '' : 'pill')}${dot('menu', m.menu, m.round ? '' : 'pill')}
    <i class="stick-dot" data-k="ls" style="${pos(m.ls)}"><b></b></i>
    <i class="stick-dot" data-k="rs" style="${pos(m.rs)}"><b></b></i>
  </div>`;
}

export function paintFront(el, s) {
  if (!el || !s) return;
  el.querySelectorAll('.hl').forEach((h) => h.classList.toggle('on', !!s.buttons[h.dataset.b]));
  for (const k of ['ls', 'rs']) {
    const d = el.querySelector(`.stick-dot[data-k="${k}"]`);
    const [x, y] = s[k];
    d.style.setProperty('--x', x.toFixed(3));
    d.style.setProperty('--y', (-y).toFixed(3));
    d.classList.toggle('on', Math.hypot(x, y) > 0.05 || !!s.buttons[k === 'ls' ? 'l3' : 'r3']);
    d.classList.toggle('press', !!s.buttons[k === 'ls' ? 'l3' : 'r3']);
  }
  for (const k of ['lt', 'rt']) {
    const g = el.querySelector(`.trig-glow[data-t="${k}"]`);
    g.style.opacity = s[k].toFixed(3);
  }
}

export function variantsFor(model) {
  return VARIANTS[model.id] ?? [
    { id: 'base', label: 'Base', body: model.body, edge: 'rgba(0,0,0,.25)', btn: '#2b2c31', btnText: '#d9dbe0', cap: '#232428', capRing: '#3b3d44', accent: model.accent },
  ];
}

// ---------- siluetas ----------
const BODIES = {
  // Manba One V2 (vista frontal): cuerpo alto, empuñaduras largas, pantalla que
  // sube hasta el borde superior y labio inferior con la fila de 4 botones.
  manba: 'M150 112 C100 112 70 140 58 185 C42 240 30 330 38 400 C44 455 80 485 115 478 C145 472 165 440 185 405 C200 380 220 366 250 364 L350 364 C380 366 400 380 415 405 C435 440 455 472 485 478 C520 485 556 455 562 400 C570 330 558 240 542 185 C530 140 500 112 450 112 L390 108 L210 108Z',
  // Machenike G5 Pro: perfil tipo Xbox, redondeado y algo más alto.
  g5pro: 'M150 100 C112 100 86 122 74 158 C54 220 34 306 42 354 C50 400 96 414 126 388 C154 364 176 330 206 312 L394 312 C424 330 446 364 474 388 C504 414 550 400 558 354 C566 306 546 220 526 158 C514 122 488 100 450 100 C424 100 404 110 384 114 L216 114 C196 110 176 100 150 100Z',
  // Machenike G3 V2: más compacto, empuñaduras cortas y gruesas.
  g3v2: 'M156 106 C118 106 92 128 80 164 C62 222 46 300 54 346 C62 390 104 404 134 380 C160 358 182 328 210 312 L390 312 C418 328 440 358 466 380 C496 404 538 390 546 346 C554 300 538 222 520 164 C508 128 482 106 444 106 C420 106 402 114 384 118 L216 118 C198 114 180 106 156 106Z',
  generic: 'M150 95 C110 95 85 115 72 150 C50 210 30 300 38 350 C45 395 90 410 120 385 C150 360 175 322 205 302 L395 302 C425 322 450 360 480 385 C510 410 555 395 562 350 C570 300 550 210 528 150 C515 115 490 95 450 95 C420 95 400 105 380 110 L220 110 C200 105 180 95 150 95Z',
};

// Posiciones por silueta.
const LAYOUT = {
  manba: { ls: [142, 200], rs: [358, 278], dpad: [222, 278], face: [464, 214], trigY: 66, bumpY: 98, viewBox: '0 50 600 470' },
  g5pro: { ls: [160, 182], rs: [372, 262], dpad: [220, 262], face: [452, 180], trigY: 56, bumpY: 90 },
  g3v2: { ls: [166, 186], rs: [370, 262], dpad: [222, 262], face: [446, 184], trigY: 62, bumpY: 96 },
  generic: { ls: [165, 168], rs: [372, 246], dpad: [235, 247], face: [436, 166], trigY: 52, bumpY: 84 },
};

export function padSvg(model, variant) {
  const art = BODIES[model.art] || model.art === 'manba' ? model.art : 'generic';
  const v = variant ?? variantsFor(model)[0];
  if (art === 'manba') return manbaSvg(v);
  const L = LAYOUT[art];
  const id = Math.random().toString(36).slice(2, 7);
  const body = BODIES[art];
  const light = isLight(v.body);
  const vars = `--body:${v.body};--edge:${v.edge};--btn:${v.btn};--btn-text:${v.btnText};--cap:${v.cap};--cap-ring:${v.capRing};--accent:${v.accent}`;

  return `
<svg class="pad pad-${art} ${light ? 'pad-light' : 'pad-dark'}" viewBox="${L.viewBox ?? '0 30 600 440'}" style="${vars}">
  <defs>
    <radialGradient id="sh${id}" cx="34%" cy="16%" r="90%">
      <stop offset="0" stop-color="#fff" stop-opacity="${light ? '.7' : '.16'}"/>
      <stop offset=".5" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="${light ? '.16' : '.35'}"/>
    </radialGradient>
    <radialGradient id="capg${id}" cx="40%" cy="30%" r="75%">
      <stop offset="0" stop-color="#fff" stop-opacity="${light ? '.5' : '.14'}"/>
      <stop offset="1" stop-color="#000" stop-opacity="${light ? '.08' : '.3'}"/>
    </radialGradient>
    <linearGradient id="rgb${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff4d6d"/><stop offset=".25" stop-color="#ffb02e"/>
      <stop offset=".5" stop-color="#35e07a"/><stop offset=".75" stop-color="#2ea8ff"/><stop offset="1" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="ring${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c084fc"/><stop offset=".5" stop-color="#60a5fa"/><stop offset="1" stop-color="#a855f7"/>
    </linearGradient>
    <linearGradient id="glass${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b2d35"/><stop offset="1" stop-color="#08080b"/>
    </linearGradient>
    <filter id="ds${id}" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#000" flood-opacity="${light ? '.16' : '.3'}"/>
    </filter>
    <filter id="glow${id}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="ltc${id}"><rect x="122" y="${L.trigY}" width="88" height="40" rx="12"/></clipPath>
    <clipPath id="rtc${id}"><rect x="390" y="${L.trigY}" width="88" height="40" rx="12"/></clipPath>
  </defs>

  ${trigger('lt', 122, L.trigY, id)}${trigger('rt', 390, L.trigY, id)}
  ${bumpers(L.bumpY)}

  <g filter="url(#ds${id})"><path class="body" d="${body}"/></g>
  <path d="${body}" fill="url(#sh${id})" pointer-events="none"/>

  ${DETAILS[art]?.(L, id, v) ?? genericCenter()}

  ${stick('ls', ...L.ls, id, art)}
  ${stick('rs', ...L.rs, id, art)}
  ${art === 'manba' ? dpadDisc(...L.dpad) : dpadCross(...L.dpad)}
  ${face(...L.face, art === 'manba' ? 35 : 34)}
</svg>`;
}

function isLight(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 150;
}

// ---------- piezas comunes ----------
function trigger(k, x, y, id) {
  return `
  <g class="trig" data-k="${k}">
    <rect class="trig-bg" x="${x}" y="${y}" width="88" height="40" rx="12"/>
    <rect class="trig-fill" clip-path="url(#${k}c${id})" x="${x}" y="${y + 40}" width="88" height="40" data-base="${y + 40}"/>
  </g>`;
}

function bumpers(y) {
  return `
  <path class="bump" data-b="lb" d="M${92} ${y + 22} C${100} ${y} ${138} ${y - 8} ${172} ${y - 6} L214 ${y - 2} C224 ${y - 1} 226 ${y + 10} 216 ${y + 14} L118 ${y + 30} C102 ${y + 32} 88 ${y + 30} 92 ${y + 22}Z"/>
  <path class="bump" data-b="rb" d="M${508} ${y + 22} C${500} ${y} ${462} ${y - 8} ${428} ${y - 6} L386 ${y - 2} C376 ${y - 1} 374 ${y + 10} 384 ${y + 14} L482 ${y + 30} C498 ${y + 32} 512 ${y + 30} 508 ${y + 22}Z"/>`;
}

function stick(k, cx, cy, id, art) {
  const ring =
    art === 'g3v2'
      ? `<circle cx="${cx}" cy="${cy}" r="41" fill="none" stroke="url(#ring${id})" stroke-width="5" filter="url(#glow${id})" opacity=".95"/>`
      : art === 'g5pro'
        ? `<circle cx="${cx}" cy="${cy}" r="42" class="clear-ring"/><circle cx="${cx}" cy="${cy}" r="36" fill="none" stroke="var(--accent)" stroke-opacity=".35" stroke-width="1.5"/>`
        : '';
  const knurl = art === 'manba' ? `<circle cx="${cx}" cy="${cy}" r="27" fill="none" stroke="var(--cap-ring)" stroke-width="4" stroke-dasharray="2 2.2"/>` : '';
  return `
  <g class="stick" data-k="${k}">
    <circle class="well" cx="${cx}" cy="${cy}" r="40"/>
    ${ring}
    <g class="cap" data-b="${k === 'ls' ? 'l3' : 'r3'}">
      <circle class="cap-base" cx="${cx}" cy="${cy}" r="30"/>
      ${knurl}
      <circle cx="${cx}" cy="${cy}" r="30" fill="url(#capg${id})"/>
      <circle class="cap-ring" cx="${cx}" cy="${cy}" r="30"/>
      <circle cx="${cx}" cy="${cy}" r="18" class="cap-dish"/>
    </g>
  </g>`;
}

function dpadCross(cx, cy) {
  const a = 13, l = 38;
  return `
  <g class="dpad">
    <circle class="well soft" cx="${cx}" cy="${cy}" r="44"/>
    <path class="btn" data-b="up" d="M${cx - a} ${cy - l} h${a * 2} v${l - a - 2} l-${a} ${a} l-${a} -${a}z"/>
    <path class="btn" data-b="down" d="M${cx - a} ${cy + l} h${a * 2} v-${l - a - 2} l-${a} -${a} l-${a} ${a}z"/>
    <path class="btn" data-b="left" d="M${cx - l} ${cy - a} v${a * 2} h${l - a - 2} l${a} -${a} l-${a} -${a}z"/>
    <path class="btn" data-b="right" d="M${cx + l} ${cy - a} v${a * 2} h-${l - a - 2} l-${a} -${a} l${a} -${a}z"/>
    <circle cx="${cx}" cy="${cy}" r="5" class="dpad-hub"/>
  </g>`;
}

function dpadDisc(cx, cy) {
  // D-pad grande sobre un disco, como el del Manba.
  return `
  <g class="dpad">
    <circle class="well" cx="${cx}" cy="${cy}" r="46"/>
    <circle cx="${cx}" cy="${cy}" r="42" class="disc"/>
    ${dpadCross(cx, cy).replace('<circle class="well soft"', '<circle class="hidden-well"')}
  </g>`;
}

function face(cx, cy, d) {
  const b = (k, x, y, l) => `<g class="btn face-b" data-b="${k}"><circle cx="${x}" cy="${y}" r="17"/><text x="${x}" y="${y + 5.5}" text-anchor="middle">${l}</text></g>`;
  return `
  <g class="face">
    ${b('y', cx, cy - d, 'Y')}${b('a', cx, cy + d, 'A')}${b('x', cx - d, cy, 'X')}${b('b', cx + d, cy, 'B')}
  </g>`;
}

function genericCenter() {
  return `
  <rect class="btn small" data-b="view" x="246" y="155" width="22" height="14" rx="7"/>
  <rect class="btn small" data-b="menu" x="332" y="155" width="22" height="14" rx="7"/>
  <circle class="btn home" data-b="home" cx="300" cy="150" r="14"/>`;
}

// ---------- detalles propios de cada modelo ----------
const DETAILS = {
  manba(L, id) {
    // Pantalla grande, fila inferior de 4 botones y franja RGB lateral.
    return `
    <g class="screen">
      <path d="M192 100 L408 100 L403 226 Q402 236 392 236 L208 236 Q198 236 197 226Z" fill="url(#glass${id})" stroke="#000" stroke-opacity=".5"/>
      <rect x="204" y="108" width="192" height="120" rx="7" fill="#0b0b0f"/>
      <text class="screen-t" x="214" y="124">PADHUB</text>
      <text class="screen-s" x="386" y="124" text-anchor="end">—</text>
      <line x1="214" y1="130" x2="386" y2="130" stroke="#f5c518" stroke-opacity=".7"/>
      <rect x="214" y="136" width="172" height="17" rx="6" fill="#1d1e24"/>
      <circle cx="224" cy="144.5" r="4" fill="#e6e6ee"/>
      <rect x="232" y="142.5" width="40" height="4" rx="2" fill="#e6e6ee" opacity=".7"/>
      <rect x="214" y="159" width="82" height="48" rx="7" fill="#1d1e24" stroke="#f5c518" stroke-width="1.6"/>
      <rect x="304" y="159" width="82" height="48" rx="7" fill="#1d1e24"/>
      <circle cx="255" cy="176" r="6" fill="#f5c518"/><circle cx="345" cy="176" r="6" fill="#e6e6ee"/>
      <rect x="237" y="190" width="36" height="4.5" rx="2" fill="#f5c518" opacity=".85"/>
      <rect x="323" y="190" width="44" height="4.5" rx="2" fill="#e6e6ee" opacity=".7"/>
      <rect x="218" y="216" width="30" height="3.5" rx="1.7" fill="#6b6e78"/><rect x="285" y="216" width="30" height="3.5" rx="1.7" fill="#6b6e78"/><rect x="352" y="216" width="30" height="3.5" rx="1.7" fill="#6b6e78"/>
    </g>
    <g class="strip">
      <path class="btn small" data-b="view" d="M206 342 h44 l4 12 h-56z"/>
      <path class="btn small" d="M258 342 h40 v12 h-40z"/>
      <path class="btn small" data-b="home" d="M302 342 h40 v12 h-40z"/>
      <path class="btn small" data-b="menu" d="M350 342 h44 l4 12 h-56z" transform="translate(0 0)"/>
    </g>
    <path d="M62 205 C52 245 47 285 47 330" fill="none" stroke="url(#rgb${id})" stroke-width="6" stroke-linecap="round" filter="url(#glow${id})"/>
    <path d="M538 205 C548 245 553 285 553 330" fill="none" stroke="url(#rgb${id})" stroke-width="6" stroke-linecap="round" filter="url(#glow${id})"/>`;
  },
  g5pro(L, id) {
    // Botón central en forma de escudo, botones pequeños, LEDs de jugador y líneas de luz.
    return `
    <path class="btn home shield" data-b="home" d="M300 128 l16 6 v10 c0 10 -8 17 -16 20 c-8 -3 -16 -10 -16 -20 v-10z"/>
    <path d="M300 136 l8 3 v6 c0 5 -4 9 -8 11 c-4 -2 -8 -6 -8 -11 v-6z" fill="var(--accent)" opacity=".85"/>
    <circle class="btn small" data-b="view" cx="252" cy="148" r="10"/>
    <rect class="btn small" data-b="menu" x="338" y="140" width="22" height="16" rx="8"/>
    <circle class="btn small" cx="272" cy="196" r="9"/>
    ${[0, 1, 2, 3].map((i) => `<circle cx="${292 + i * 3}" cy="${226 + i * 12}" r="3" fill="var(--accent)" opacity="${0.9 - i * 0.18}"/>`).join('')}
    <path d="M86 230 C84 246 84 258 86 270" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" filter="url(#glow${id})"/>
    <path d="M512 200 C520 214 526 226 530 240" fill="none" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" filter="url(#glow${id})"/>
    <path d="M252 306 L348 306" stroke="var(--accent)" stroke-width="3.5" stroke-linecap="round" filter="url(#glow${id})"/>
    <text class="model-mark" x="210" y="312" text-anchor="middle">G5 PRO</text>`;
  },
  g3v2(L, id) {
    // Botón central redondo con luz, botones T / FN y círculo de captura.
    return `
    <circle cx="300" cy="140" r="17" fill="none" stroke="var(--accent)" stroke-width="2" opacity=".6" filter="url(#glow${id})"/>
    <circle class="btn home" data-b="home" cx="300" cy="140" r="14"/>
    <path d="M293 146 l7 -12 l7 12z" fill="#60a5fa" opacity=".9"/>
    <circle class="btn small" data-b="view" cx="254" cy="176" r="10"/>
    <rect class="btn small" x="288" y="180" width="24" height="15" rx="7.5"/>
    <text class="tiny" x="300" y="191.5" text-anchor="middle">T</text>
    <circle class="btn small" data-b="menu" cx="346" cy="176" r="10"/>
    <path d="M341 173h10M341 176.5h10M341 180h10" stroke="var(--btn-text)" stroke-width="1.3"/>
    <rect class="btn small" x="262" y="204" width="28" height="15" rx="7.5"/>
    <text class="tiny" x="276" y="215.5" text-anchor="middle">FN</text>`;
  },
};

// ---------- Manba One V2 (vista frontal) ----------
// Coordenadas propias en un lienzo de 720x580, con las proporciones del mando
// visto de frente: cuerpo ancho, pantalla que sobresale del borde superior,
// empuñaduras largas y abiertas, y la fila de 4 botones sobre el arco inferior.
const MANBA_BODY =
  'M268 98 L250 104 C210 106 166 109 140 121 C118 133 106 157 102 190 C96 240 96 300 104 350 ' +
  'C112 400 124 440 140 462 C152 477 177 479 193 466 C207 452 215 421 227 393 C239 369 257 360 281 358 ' +
  'L439 358 C463 360 481 369 493 393 C505 421 513 452 527 466 C543 479 568 477 580 462 ' +
  'C596 440 608 400 616 350 C624 300 624 240 618 190 C614 157 602 133 580 121 C554 109 510 106 470 104 L452 98Z';

function manbaSvg(v) {
  const id = Math.random().toString(36).slice(2, 7);
  const light = isLight(v.body);
  const white = v.id === 'blanco';
  const vars = `--body:${v.body};--edge:${v.edge};--btn:${v.btn};--btn-text:${v.btnText};--cap:${v.cap};--cap-ring:${v.capRing};--accent:${v.accent}`;
  const trig = (k, x) => `
    <g class="trig" data-k="${k}">
      <rect class="trig-bg" x="${x}" y="70" width="86" height="34" rx="11"/>
      <rect class="trig-fill" clip-path="url(#${k}c${id})" x="${x}" y="104" width="86" height="34" data-base="104" data-h="34"/>
    </g>`;
  const screw = (x, y) => `<g class="screw"><circle cx="${x}" cy="${y}" r="5.5"/><path d="M${x - 2.5} ${y}h5M${x} ${y - 2.5}v5"/></g>`;
  return `
<svg class="pad pad-manba ${light ? 'pad-light' : 'pad-dark'}" viewBox="78 52 564 452" style="${vars}">
  <defs>
    <radialGradient id="sh${id}" cx="40%" cy="12%" r="95%">
      <stop offset="0" stop-color="#fff" stop-opacity="${light ? '.75' : '.14'}"/>
      <stop offset=".55" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity="${light ? '.14' : '.4'}"/>
    </radialGradient>
    <linearGradient id="rim${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="${light ? '.9' : '.18'}"/><stop offset=".25" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="capg${id}" cx="40%" cy="30%" r="75%">
      <stop offset="0" stop-color="#fff" stop-opacity="${light ? '.55' : '.16'}"/>
      <stop offset="1" stop-color="#000" stop-opacity="${light ? '.08' : '.35'}"/>
    </radialGradient>
    <linearGradient id="rgb${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe14d"/><stop offset=".3" stop-color="#5df07a"/>
      <stop offset=".6" stop-color="#2ec5ff"/><stop offset="1" stop-color="#7b5cff"/>
    </linearGradient>
    <linearGradient id="glass${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#30323a"/><stop offset="1" stop-color="#07070a"/>
    </linearGradient>
    <filter id="ds${id}" x="-20%" y="-20%" width="140%" height="160%">
      <feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#000" flood-opacity="${light ? '.16' : '.32'}"/>
    </filter>
    <filter id="glow${id}" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <clipPath id="ltc${id}"><rect x="150" y="70" width="86" height="34" rx="11"/></clipPath>
    <clipPath id="rtc${id}"><rect x="484" y="70" width="86" height="34" rx="11"/></clipPath>
  </defs>

  ${trig('lt', 150)}${trig('rt', 484)}
  <path class="bump" data-b="lb" d="M126 128 C134 110 170 98 214 96 L250 98 C258 99 258 108 250 110 L150 128 C136 131 122 136 126 128Z"/>
  <path class="bump" data-b="rb" d="M594 128 C586 110 550 98 506 96 L470 98 C462 99 462 108 470 110 L570 128 C584 131 598 136 594 128Z"/>

  <g filter="url(#ds${id})"><path class="body" d="${MANBA_BODY}"/></g>
  <path d="${MANBA_BODY}" fill="url(#sh${id})" pointer-events="none"/>
  <path d="${MANBA_BODY}" fill="url(#rim${id})" pointer-events="none"/>

  ${white ? `
  <g class="inner">
    <path d="M132 210 C150 196 200 200 232 222 L248 300 C230 330 200 350 168 352 C146 340 130 300 132 210Z"/>
    <path d="M588 210 C570 196 520 200 488 222 L472 300 C490 330 520 350 552 352 C574 340 590 300 588 210Z"/>
    <path class="vent" d="M146 362 l20 30 M138 372 l18 28 M496 380 l28 -18 M500 392 l28 -18" />
    <path class="vent" d="M336 306 l-6 12 M346 306 l-6 12 M356 306 l-6 12 M366 306 l-6 12 M376 306 l-6 12 M386 306 l-6 12"/>
    ${screw(152, 150)}${screw(568, 150)}${screw(360, 284)}${screw(138, 432)}${screw(582, 432)}${screw(462, 300)}
  </g>` : ''}

  <g class="screen">
    <path d="M264 92 L456 92 L451 220 Q450 232 438 232 L282 232 Q270 232 269 220Z" fill="url(#glass${id})" stroke="#000" stroke-opacity=".55"/>
    <rect x="276" y="102" width="168" height="122" rx="7" fill="#0b0b0f"/>
    <circle cx="287" cy="114" r="4.5" fill="none" stroke="#e6e6ee" stroke-width="1.4"/>
    <text class="screen-t" x="296" y="117.5">PADHUB</text>
    <text class="screen-s" x="436" y="117.5" text-anchor="end">—</text>
    <line x1="283" y1="124" x2="437" y2="124" stroke="#f5c518" stroke-opacity=".75"/>
    <rect x="283" y="129" width="154" height="16" rx="6" fill="#1d1e24"/>
    <circle cx="292" cy="137" r="4" fill="#e6e6ee"/><rect x="300" y="135" width="40" height="4" rx="2" fill="#e6e6ee" opacity=".7"/>
    <rect x="283" y="150" width="73" height="48" rx="7" fill="#1d1e24" stroke="#f5c518" stroke-width="1.6"/>
    <rect x="364" y="150" width="73" height="48" rx="7" fill="#1d1e24"/>
    <circle cx="319.5" cy="167" r="6" fill="#f5c518"/><circle cx="400.5" cy="167" r="6" fill="#e6e6ee"/>
    <rect x="303" y="181" width="33" height="4.5" rx="2" fill="#f5c518" opacity=".85"/>
    <rect x="381" y="181" width="39" height="4.5" rx="2" fill="#e6e6ee" opacity=".7"/>
    <rect x="287" y="210" width="28" height="3.5" rx="1.7" fill="#6b6e78"/><rect x="346" y="210" width="28" height="3.5" rx="1.7" fill="#6b6e78"/><rect x="405" y="210" width="28" height="3.5" rx="1.7" fill="#6b6e78"/>
  </g>

  <path class="ledge" d="M236 334 C290 326 430 326 484 334 L492 358 L228 358Z"/>
  <g class="strip">
    <path class="btn small" data-b="view" d="M250 337 h50 l-3 13 h-52z"/>
    <path class="btn small" d="M306 337 h50 v13 h-50z"/>
    <path class="btn small" data-b="home" d="M362 337 h50 v13 h-50z"/>
    <path class="btn small" data-b="menu" d="M418 337 h50 l5 13 h-52z"/>
  </g>

  <path d="M109 205 C102 250 101 300 108 345" fill="none" stroke="url(#rgb${id})" stroke-width="5.5" stroke-linecap="round" filter="url(#glow${id})"/>
  <path d="M611 205 C618 250 619 300 612 345" fill="none" stroke="url(#rgb${id})" stroke-width="5.5" stroke-linecap="round" filter="url(#glow${id})"/>

  ${stick('ls', 205, 196, id, 'manba')}
  ${stick('rs', 415, 268, id, 'manba')}
  ${dpadDisc(284, 270)}
  ${face(510, 209, 33)}
</svg>`;
}

// ---------- estado en vivo ----------
export function paint(svg, s) {
  if (!svg || !s) return;
  svg.querySelectorAll('[data-b]').forEach((el) => el.classList.toggle('on', !!s.buttons[el.dataset.b]));
  for (const k of ['ls', 'rs']) {
    const cap = svg.querySelector(`.stick[data-k="${k}"] .cap`);
    const [x, y] = s[k];
    cap.style.transform = `translate(${x * 10}px, ${-y * 10}px)`;
  }
  for (const k of ['lt', 'rt']) {
    const f = svg.querySelector(`.trig[data-k="${k}"] .trig-fill`);
    f.setAttribute('y', +f.dataset.base - (+f.dataset.h || 40) * s[k]);
  }
}

export function screenText(svg, top, bottom) {
  const t = svg?.querySelector('.screen-t');
  if (!t) return;
  t.textContent = top;
  svg.querySelector('.screen-s').textContent = bottom;
}
