import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createSpaceScene } from './three/spaceScene.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ════════════════════════════════════════════════════════════
   3D scene
   ════════════════════════════════════════════════════════════ */
const telemetry = { lat: 0, lon: 0, altKm: 509, velKmS: 7.61, name: 'CARTOSAT-3' };
const satLabel = $('#sat-label');
const satData = $('#sat-data');
const hud = { lat: $('#hud-lat'), lon: $('#hud-lon'), alt: $('#hud-alt'), vel: $('#hud-vel') };
let heroFade = 1;
let lastHudUpdate = 0;

const fmtLat = (v) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? 'N' : 'S'}`;
const fmtLon = (v) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? 'E' : 'W'}`;

let scene = null;
try {
  scene = createSpaceScene($('#webgl'), {
    onFrame(info) {
      Object.assign(telemetry, info);
      const vis = info.visibility * heroFade;
      satLabel.style.opacity = vis.toFixed(3);
      satLabel.style.transform = `translate3d(${info.screenX}px, ${info.screenY}px, 0)`;

      const now = performance.now();
      if (now - lastHudUpdate > 120) {
        lastHudUpdate = now;
        satData.textContent = `${fmtLat(info.lat)} · ${fmtLon(info.lon)}`;
        hud.lat.textContent = fmtLat(info.lat);
        hud.lon.textContent = fmtLon(info.lon);
        hud.alt.textContent = `${info.altKm.toFixed(2)} km`;
        hud.vel.textContent = `${info.velKmS.toFixed(2)} km/s`;
      }
    },
  });
} catch (err) {
  console.warn('WebGL unavailable, falling back to static background.', err);
  document.body.classList.add('no-webgl');
}

// Scroll-driven keyframes for the planet (one per section)
const KEYFRAMES = {
  desktop: {
    hero: { x: 2.7, y: -0.1, z: 0, s: 1 },
    about: { x: -3.6, y: 0.2, z: -2.5, s: 1 },
    skills: { x: 0, y: 0.4, z: -9, s: 1.2 },
    projects: { x: 4.4, y: -1.3, z: -5, s: 1 },
    experience: { x: 3.4, y: 0.2, z: -1.5, s: 1 },
    contact: { x: 0, y: -4.7, z: 0.5, s: 1.5 },
  },
  mobile: {
    hero: { x: 0, y: -2.7, z: -2.5, s: 0.9 },
    about: { x: 0.8, y: 2.2, z: -6, s: 1 },
    skills: { x: 0, y: 0, z: -10, s: 1 },
    projects: { x: -0.8, y: -1.6, z: -8, s: 1 },
    experience: { x: 1, y: 1.6, z: -7, s: 1 },
    contact: { x: 0, y: -4.6, z: -1.5, s: 1.3 },
  },
};

const sceneSections = $$('[data-scene]');
let anchors = [];
const measure = () => {
  anchors = sceneSections.map((s) => s.getBoundingClientRect().top + window.scrollY);
};

function updateSceneFromScroll() {
  const vh = window.innerHeight;
  const y = window.scrollY;
  heroFade = clamp(1 - y / (vh * 0.45));

  if (!scene) return;
  const set = window.innerWidth <= 768 ? KEYFRAMES.mobile : KEYFRAMES.desktop;
  let from = 0;
  let to = 0;
  let t = 0;
  for (let i = 1; i < anchors.length; i++) {
    const start = anchors[i] - vh;
    if (y >= anchors[i]) { from = to = i; continue; }
    if (y > start) { from = i - 1; to = i; t = (y - start) / vh; }
    break;
  }
  const a = set[sceneSections[from].dataset.scene];
  const b = set[sceneSections[to].dataset.scene];
  const k = smooth(clamp(t));
  scene.setTarget({
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    z: a.z + (b.z - a.z) * k,
    s: a.s + (b.s - a.s) * k,
  });
}

/* ════════════════════════════════════════════════════════════
   Loader → launch
   ════════════════════════════════════════════════════════════ */
const STATUS = [
  'Initialising guidance systems…',
  'Fetching orbital elements…',
  'Propagating SGP4 model…',
  'Rendering planetary shaders…',
  'Deploying solar arrays…',
  'Calibrating telemetry link…',
  'Go for launch.',
];

function runCountdown() {
  return new Promise((resolve) => {
    const countEl = $('#loader-count');
    const bar = $('#loader-bar');
    const status = $('#loader-status');
    let n = 10;
    const tick = () => {
      countEl.textContent = n > 0 ? `T-${n}` : 'LIFT OFF';
      bar.style.width = `${((10 - n) / 10) * 100}%`;
      status.textContent = STATUS[Math.min(STATUS.length - 1, Math.floor(((10 - n) / 10) * STATUS.length))];
      if (n-- <= 0) return setTimeout(resolve, 450);
      setTimeout(tick, 170);
    };
    tick();
  });
}

// Initial hidden states for the hero intro
gsap.set('[data-intro-line]', { yPercent: 115 });
gsap.set('[data-intro]', { opacity: 0, y: 26 });

Promise.all([runCountdown(), document.fonts?.ready ?? Promise.resolve()]).then(() => {
  $('#loader').classList.add('is-done');
  document.body.classList.remove('is-loading');
  scene?.intro();
  measure();
  updateSceneFromScroll();

  const tl = gsap.timeline({ delay: 0.35, defaults: { ease: 'expo.out' } });
  tl.to('[data-intro-line]', { yPercent: 0, duration: 1.4, stagger: 0.12 })
    .to('[data-intro]', { opacity: 1, y: 0, duration: 1.2, stagger: 0.09, clearProps: 'transform' }, '-=1.1');
  ScrollTrigger.refresh();
});

/* ════════════════════════════════════════════════════════════
   Scroll: progress bar, nav, scene, reveals
   ════════════════════════════════════════════════════════════ */
const nav = $('#nav');
const progress = $('#scroll-progress');
let lastY = window.scrollY;

function onScroll() {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;
  nav.classList.toggle('is-scrolled', y > 40);
  if (!nav.classList.contains('is-open')) nav.classList.toggle('is-hidden', y > lastY && y > 600);
  scene?.addSpin((y - lastY) * 0.0008);
  lastY = y;
  updateSceneFromScroll();
}
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { measure(); updateSceneFromScroll(); });
window.addEventListener('load', () => { measure(); updateSceneFromScroll(); ScrollTrigger.refresh(); });
measure();
updateSceneFromScroll();

ScrollTrigger.batch('[data-reveal]', {
  start: 'top 88%',
  once: true,
  onEnter: (batch) =>
    batch.forEach((el, i) => {
      el.style.setProperty('--d', `${i * 0.09}s`);
      el.classList.add('is-revealed');
    }),
});

// Active nav link per section
$$('main section[id]').forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 50%',
    end: 'bottom 50%',
    onToggle: ({ isActive }) => {
      if (!isActive) return;
      $$('[data-nav]').forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${section.id}`));
    },
  });
});

// Mobile menu
const toggle = $('#nav-toggle');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
});
$$('#nav-links a').forEach((a) =>
  a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  })
);

/* ════════════════════════════════════════════════════════════
   Animated counters
   ════════════════════════════════════════════════════════════ */
$$('[data-count]').forEach((el) => {
  const target = parseFloat(el.dataset.count);
  const decimals = parseInt(el.dataset.decimals || '0', 10);
  const obj = { v: 0 };
  ScrollTrigger.create({
    trigger: el,
    start: 'top 90%',
    once: true,
    onEnter: () =>
      gsap.to(obj, {
        v: target,
        duration: 2.2,
        ease: 'power3.out',
        onUpdate: () => (el.textContent = obj.v.toFixed(decimals)),
      }),
  });
});

/* ════════════════════════════════════════════════════════════
   Live terminal (mirrors isro-telemetry-engine/tracker.js output)
   ════════════════════════════════════════════════════════════ */
const term = $('#terminal-body');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function addLine(html, cls = '') {
  const div = document.createElement('div');
  if (cls) div.className = cls;
  div.innerHTML = html;
  term.appendChild(div);
  while (term.children.length > 40) term.firstElementChild.remove();
  return div;
}

async function runTerminal() {
  const cmd = addLine('', 't-cmd');
  const caret = '<span class="caret"></span>';
  const text = 'node tracker.js';
  for (let i = 0; i <= text.length; i++) {
    cmd.innerHTML = text.slice(0, i) + caret;
    await sleep(55 + Math.random() * 50);
  }
  await sleep(300);
  cmd.innerHTML = text;
  addLine('Fetching live ISRO orbital elements from CelesTrak...');
  await sleep(700);
  addLine(`<span class="t-ok">✔ TLE received</span>`);
  addLine(`\nTracking Target: <span class="t-sat">CARTOSAT-3</span>`);
  await sleep(250);
  addLine('Line 1: 1 44804U 19081A   26279.35416667  .00001234  00000-0  56789-4 0  9993');
  addLine('Line 2: 2 44804  97.4012 341.5521 0012345  92.1234 268.1234 15.19123456 37812\n');
  await sleep(500);
  addLine('--- Live Telemetry Propagation Started (Ctrl+C to stop) ---');

  const emit = () => {
    const ts = new Date().toISOString();
    const lat = telemetry.lat.toFixed(4).padStart(8);
    const lon = telemetry.lon.toFixed(4).padStart(9);
    addLine(
      `<span class="t-time">[${ts}]</span> Lat: <span class="t-num">${lat}°</span> | ` +
        `Lon: <span class="t-num">${lon}°</span> | Alt: <span class="t-num">${telemetry.altKm.toFixed(2)} km</span> | ` +
        `Velocity: <span class="t-num">${telemetry.velKmS.toFixed(2)} km/s</span>`
    );
  };
  emit();
  setInterval(emit, 2000);
}
ScrollTrigger.create({ trigger: '#terminal', start: 'top 80%', once: true, onEnter: runTerminal });

/* ════════════════════════════════════════════════════════════
   Pointer: parallax, drag-to-spin, cursor, tilt, magnetic
   ════════════════════════════════════════════════════════════ */
window.addEventListener(
  'pointermove',
  (e) => scene?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1),
  { passive: true }
);

// Drag the planet in the hero
const hero = $('#hero');
let dragging = false;
let dragX = 0;
hero.addEventListener('pointerdown', (e) => {
  if (e.target.closest('a, button, .hud')) return;
  dragging = true;
  dragX = e.clientX;
  ring?.classList.add('is-drag');
});
window.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  scene?.addSpin((e.clientX - dragX) * 0.012);
  dragX = e.clientX;
});
window.addEventListener('pointerup', () => {
  dragging = false;
  ring?.classList.remove('is-drag');
});

// Custom cursor
const dot = $('#cursor');
const ring = finePointer ? $('#cursor-ring') : null;
if (finePointer) {
  const pos = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPos = { ...pos };
  window.addEventListener('pointermove', (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
  });
  gsap.ticker.add(() => {
    ringPos.x += (pos.x - ringPos.x) * 0.18;
    ringPos.y += (pos.y - ringPos.y) * 0.18;
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
  });
  document.addEventListener('pointerover', (e) => {
    ring.classList.toggle('is-hover', !!e.target.closest('a, button, .tilt, .magnetic, input, textarea'));
  });
}

// 3D tilt + glare on glass cards
if (finePointer) {
  $$('.glass').forEach((el) => {
    const isTilt = el.classList.contains('tilt');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
      if (isTilt) {
        const strength = el.classList.contains('project--featured') ? 4 : 8;
        el.classList.add('is-tilting');
        el.style.setProperty('--ry', `${(px - 0.5) * strength}deg`);
        el.style.setProperty('--rx', `${(0.5 - py) * strength}deg`);
      }
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('is-tilting');
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
    });
  });

  // Magnetic buttons
  $$('.magnetic').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - (r.left + r.width / 2)) * 0.3,
        y: (e.clientY - (r.top + r.height / 2)) * 0.35,
        duration: 0.5,
        ease: 'power3.out',
      });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }));
  });
}

/* ════════════════════════════════════════════════════════════
   Contact form
   ════════════════════════════════════════════════════════════ */
const toast = $('#toast');
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3800);
}

$('#contact-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  let ok = true;
  $$('input, textarea', form).forEach((input) => {
    const valid = input.checkValidity() && input.value.trim() !== '';
    input.closest('.field').classList.toggle('is-invalid', !valid);
    if (!valid) ok = false;
  });
  if (!ok) return showToast('⚠ Signal incomplete — please fill in every field.');
  const btn = $('#contact-submit span');
  btn.textContent = 'Transmitting…';
  setTimeout(() => {
    form.reset();
    btn.textContent = 'Transmit message';
    showToast('✦ Transmission received — I’ll get back to you soon.');
  }, 1100);
});

/* ════════════════════════════════════════════════════════════
   Footer: year + IST mission clock
   ════════════════════════════════════════════════════════════ */
$('#year').textContent = new Date().getFullYear();
const clockEl = $('#clock');
const tickClock = () => {
  clockEl.textContent = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
};
tickClock();
setInterval(tickClock, 1000);
