// ============================================================
// MUBARAK MERCANTILE — decorative video system (vanilla JS)
//
// Reusable components (build DOM from options):
//   VideoPosterFallback        static poster layer, no <video> at all
//   ReducedMotionVideoFallback poster-only replacement (reduced motion,
//                              Save-Data, failed source)
//   SafeBackgroundVideo        absolute layer that fills its host
//   ContainedFeatureVideo      bounded media card beside existing copy
//   VideoSection               SafeBackgroundVideo bound to a <section>
//
// Playback policy:
//   * no source is attached until a video actually wins its viewport
//   * at most ONE video plays anywhere on the page at a time
//   * pauses on scroll-out, on tab hide, and when another video wins
//   * accent mode: play N ms, then hold on a still frame
//   * reduced motion / Save-Data / 2G -> poster only, never fetched
//   * failed source -> poster only (never a black rectangle)
// ============================================================

/* ------------------------------------------------------------
 * Asset map
 * ---------------------------------------------------------- */

const ORIGINALS = {
  '3d-hero': '3D hero.mp4',
  'chili-burst-cta': 'chili burst CTA.mp4',
  'export-journey': 'export journey.mp4',
  'final-cta-background': 'final CTA background.mp4',
  'ground-spices-texture-loop': 'ground spices texture loop.mp4',
  'kitchen-application': 'kitchen application.mp4',
  'premium-packaging-reveal': 'premium packaging reveal.mp4',
  'sourcing-and-quality': 'sourcing and quality.mp4',
  'whole-spice-category-loop': 'whole spice category loop.mp4',
  'world-reach-abstract-animation': 'world reach abstract animation.mp4',
};

const MOBILE_MAX = 767;
const MAX_ATTACHED = 5;
const DEFAULT_ACCENT_MS = 3500;
const HERO_TIMEOUT_MS = 10000;

const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

function saveDataOn() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return false;
  if (c.saveData) return true;
  return /(^|-)2g$/.test(c.effectiveType || '');
}

/** Motion is allowed only when the user, the network and the OS agree. */
export function motionAllowed() {
  if (reduceQuery.matches) return false;
  if (saveDataOn()) return false;
  return true;
}

function posterUrl(slug, ext) {
  return `public/posters/${slug}.${ext}`;
}

/** Compressed variant first on phones, WebM first everywhere else. */
function sourcesFor(slug) {
  const out = [];
  if (window.innerWidth <= MOBILE_MAX) {
    out.push({ src: `public/web/${slug}.sm.mp4`, type: 'video/mp4' });
  }
  out.push({ src: `public/web/${slug}.webm`, type: 'video/webm' });
  out.push({ src: `public/web/${slug}.mp4`, type: 'video/mp4' });
  const original = ORIGINALS[slug];
  if (original) out.push({ src: `public/${encodeURI(original)}`, type: 'video/mp4' });
  return out;
}

/* ------------------------------------------------------------
 * Components
 * ---------------------------------------------------------- */

/** Static poster layer. Used wherever a video must not (or cannot) run. */
export function VideoPosterFallback({ slug } = {}) {
  const el = document.createElement('div');
  el.className = 'video-poster';
  el.setAttribute('aria-hidden', 'true');
  if (slug) el.style.backgroundImage = `url("${posterUrl(slug, 'jpg')}")`;
  return el;
}

/**
 * Poster-only replacement for ReducedMotionVideoFallback: identical layer,
 * but explicitly flagged so callers can tell motion was suppressed.
 */
export function ReducedMotionVideoFallback(opts = {}) {
  const el = VideoPosterFallback(opts);
  el.dataset.motionFallback = 'true';
  return el;
}

function buildOverlay(name) {
  const el = document.createElement('div');
  el.className = `video-overlay ov-${name}`;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

function createVideo({ slug, mode = 'contained', overlay = null, accentMs = null } = {}) {
  const v = document.createElement('video');
  v.className = 'video';
  v.dataset.video = slug;
  v.dataset.mode = mode;
  if (overlay) v.dataset.overlay = overlay;
  if (accentMs) v.dataset.accentMs = String(accentMs);
  v.poster = posterUrl(slug, 'webp');
  // Required playback contract for decorative background video.
  v.autoplay = true;
  v.muted = true;
  v.loop = true;
  v.playsInline = true;
  v.preload = 'none';
  v.setAttribute('autoplay', '');
  v.setAttribute('muted', '');
  v.setAttribute('loop', '');
  v.setAttribute('playsinline', '');
  v.setAttribute('preload', 'none');
  v.setAttribute('aria-hidden', 'true');
  v.setAttribute('disablepictureinpicture', '');
  v.tabIndex = -1;
  return v;
}

/**
 * Absolute layer that fills `host`. Existing markup (video + overlay)
 * is adopted, never duplicated.
 */
export function SafeBackgroundVideo({ host, video = null, opacity = null, overlay = null } = {}) {
  if (!host) return null;
  const v = video || host.querySelector('video');

  const layer = document.createElement('div');
  layer.className = 'video-layer';
  layer.setAttribute('aria-hidden', 'true');

  if (opacity != null) host.style.setProperty('--video-opacity', String(opacity));
  host.classList.add('video-host');

  const existingOverlay = host.querySelector(':scope > .video-overlay');
  layer.appendChild(VideoPosterFallback({ slug: v ? v.dataset.video : host.dataset.videoHost }));
  if (v) layer.appendChild(v);
  if (existingOverlay) layer.appendChild(existingOverlay);
  else if (overlay) layer.appendChild(buildOverlay(overlay));

  host.insertBefore(layer, host.firstChild);
  return layer;
}

/**
 * Bounded media card sitting beside existing copy. Poster (and an optional
 * soft overlay) are added if the markup did not already provide them.
 */
export function ContainedFeatureVideo({ video, overlay = null, frame = null } = {}) {
  if (!video) return null;
  const host = frame || video.parentElement;
  const slug = video.dataset.video;

  if (slug && !host.querySelector(':scope > .video-poster')) {
    host.insertBefore(VideoPosterFallback({ slug: slug }), host.firstChild);
  }
  const wantsOverlay = overlay || video.dataset.overlay;
  if (wantsOverlay && wantsOverlay !== 'none' && !host.querySelector(':scope > .video-overlay')) {
    host.appendChild(buildOverlay(wantsOverlay));
  }
  return host;
}

/** Background video bound to a section: wraps and registers in one step. */
export function VideoSection(section, opts = {}) {
  if (!section) return null;
  const video = opts.video || section.querySelector(':scope > video[data-video]');
  const layer = SafeBackgroundVideo({
    host: section,
    video,
    opacity: opts.opacity != null ? opts.opacity : section.dataset.opacity,
    overlay: opts.overlay || (video && video.dataset.overlay),
  });
  if (video) register(video);
  return layer;
}

/* ------------------------------------------------------------
 * Registry + single-active playback
 * ---------------------------------------------------------- */

const entries = new Map();
let io = null;
let reconciling = false;

function attachedCount() {
  let n = 0;
  entries.forEach((e) => { if (e.attached) n += 1; });
  return n;
}

function prepare(video) {
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.preload = 'none';
  video.setAttribute('aria-hidden', 'true');
  video.setAttribute('disablepictureinpicture', '');
  video.tabIndex = -1;

  const mode = video.dataset.mode || 'contained';
  if (mode === 'background' || mode === 'accent') {
    if (!video.closest('.video-layer')) {
      VideoSection(video.closest('section') || video.parentElement, { video });
    }
  } else {
    ContainedFeatureVideo({ video });
  }
  return video;
}

function register(video) {
  if (entries.has(video)) return entries.get(video);

  const entry = {
    video,
    slug: video.dataset.video,
    mode: video.dataset.mode || 'contained',
    host: video.closest('.video-layer') || video.parentElement,
    accentMs: parseInt(video.dataset.accentMs || String(DEFAULT_ACCENT_MS), 10),
    inView: false,
    score: 0,
    attached: false,
    ready: false,
    playing: false,
    accentDone: false,
    accentPending: false,
    blocked: !motionAllowed(),
    wins: 0,
  };
  entries.set(video, entry);

  video.classList.add('is-loading');

  video.addEventListener('loadeddata', () => markReady(entry));
  video.addEventListener('canplay', () => markReady(entry));
  video.addEventListener('error', () => markFailed(entry));
  video.addEventListener('playing', () => {
    entry.playing = true;
    // Accent clips play for a beat, then hold on their last frame.
    if (entry.mode === 'accent' && entry.accentPending) {
      entry.accentPending = false;
      window.setTimeout(() => { pause(entry); entry.accentDone = true; }, entry.accentMs);
    }
  });
  video.addEventListener('pause', () => { entry.playing = false; });

  observe(video);
  return entry;
}

function markReady(entry) {
  entry.ready = true;
  entry.video.classList.remove('is-loading');
  entry.video.classList.add('is-ready');
}

function markFailed(entry) {
  entry.ready = false;
  entry.video.classList.remove('is-loading');
  entry.video.classList.add('is-failed');
  entry.host.classList.add('is-failed');
  pause(entry);
}

function attach(entry) {
  if (entry.attached) return;
  entry.attached = true;
  entry.video.classList.add('is-loading');
  for (const s of sourcesFor(entry.slug)) {
    const el = document.createElement('source');
    el.src = s.src;
    if (s.type) el.type = s.type;
    entry.video.appendChild(el);
  }
  entry.video.load();
}

function detach(entry) {
  if (!entry.attached) return;
  pause(entry);
  while (entry.video.firstChild) entry.video.removeChild(entry.video.firstChild);
  entry.video.removeAttribute('src');
  entry.video.load();
  entry.attached = false;
  entry.ready = false;
  entry.video.classList.remove('is-ready', 'is-failed');
  entry.video.classList.add('is-loading');
  entry.host.classList.remove('is-failed');
}

function ensureCapacity(entry) {
  if (attachedCount() < MAX_ATTACHED) return true;
  const spare = [...entries.values()].find((x) => x.attached && !x.inView && x !== entry);
  if (!spare) return false;
  detach(spare);
  return true;
}

function pause(entry) {
  if (!entry) return;
  if (!entry.video.paused) entry.video.pause();
  entry.playing = false;
}

function play(entry) {
  if (!entry || entry.blocked || entry.playing) return;
  if (!entry.attached) {
    if (!ensureCapacity(entry)) return;
    attach(entry);
  }
  entry.wins += 1;
  const p = entry.video.play();
  if (p && typeof p.catch === 'function') {
    p.catch(() => { /* autoplay refused — poster stays visible */ });
  }
  if (entry.mode === 'accent' && !entry.accentDone && !entry.accentPending) {
    entry.accentPending = true;
  }
}

function scoreOf(entry) {
  const r = entry.video.getBoundingClientRect();
  const top = Math.max(r.top, 0);
  const bottom = Math.min(r.bottom, window.innerHeight);
  const visible = Math.max(0, bottom - top);
  const mid = window.innerHeight / 2;
  const straddlesCenter = r.top <= mid && r.bottom >= mid;
  return visible + (straddlesCenter ? window.innerHeight * 0.5 : 0);
}

function reconcile() {
  if (reconciling) return;
  reconciling = true;
  try {
    if (document.hidden) {
      entries.forEach(pause);
      return;
    }
    const candidates = [];
    entries.forEach((entry) => {
      if (entry.blocked || !entry.inView) {
        pause(entry);
        return;
      }
      if (entry.mode === 'accent' && entry.accentDone) {
        pause(entry);
        return;
      }
      entry.score = scoreOf(entry);
      candidates.push(entry);
    });
    if (!candidates.length) return;
    candidates.sort((a, b) => b.score - a.score);
    const winner = candidates[0];
    entries.forEach((entry) => { if (entry !== winner) pause(entry); });
    play(winner);
  } finally {
    reconciling = false;
  }
}

function observe(video) {
  if (!('IntersectionObserver' in window)) {
    const entry = entries.get(video);
    if (entry) entry.inView = true;
    return;
  }
  if (!io) {
    io = new IntersectionObserver((records) => {
      for (const record of records) {
        const entry = entries.get(record.target);
        if (entry) entry.inView = record.isIntersecting;
      }
      reconcile();
    }, { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1], rootMargin: '0px' });
  }
  io.observe(video);
}

/* ------------------------------------------------------------
 * Entry points
 * ---------------------------------------------------------- */

/**
 * Wire every decorative video already present in the markup.
 * Hero video is handled separately by initHeroVideo().
 */
export function initVideos() {
  document.querySelectorAll('video[data-video]').forEach((video) => {
    if (video.dataset.mode === 'hero') return;
    prepare(video);
    register(video);
  });

  document.addEventListener('visibilitychange', reconcile, { passive: true });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(reconcile, 220);
  }, { passive: true });

  if (typeof reduceQuery.addEventListener === 'function') {
    reduceQuery.addEventListener('change', () => {
      entries.forEach((entry) => {
        entry.blocked = !motionAllowed();
        if (entry.blocked) pause(entry);
      });
      reconcile();
    });
  }

  reconcile();
}

/**
 * Hero card video. Resolves:
 *   'ready'   video took over the card
 *   'static'  motion suppressed — poster only, no fallback chain
 *   'failed'  source unusable — caller should start the WebGL scene
 */
export function initHeroVideo(container) {
  return new Promise((resolve) => {
    const video = container.querySelector('video[data-video]');
    const loading = container.querySelector('.scene-loading');
    let settled = false;
    let timer = 0;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (loading) loading.classList.add('done');
      resolve(result);
    };

    if (!video) {
      finish('static');
      return;
    }

    prepare(video);
    const entry = register(video);

    if (entry.blocked) {
      container.classList.add('video-static');
      finish('static');
      return;
    }

    const fail = () => {
      if (settled) return;
      entry.video.remove();
      const poster = container.querySelector('.video-poster');
      if (poster) poster.remove();
      entries.delete(video);
      container.classList.add('video-failed');
      finish('failed');
    };

    const succeed = () => {
      container.classList.add('video-live');
      finish('ready');
    };

    video.addEventListener('loadeddata', succeed, { once: true });
    video.addEventListener('canplay', succeed, { once: true });
    video.addEventListener('error', fail, { once: true });

    timer = window.setTimeout(fail, HERO_TIMEOUT_MS);

    entry.inView = true;
    attach(entry);
    const p = entry.video.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
    reconcile();
  });
}
