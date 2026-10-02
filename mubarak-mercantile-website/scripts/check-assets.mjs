// Verifies every local asset referenced by the HTML pages exists on disk,
// and that each decorative <video> carries the required markup contract.
import { readFileSync, existsSync } from 'node:fs';

const files = ['index.html', 'about.html', 'products.html', 'export.html', 'contact.html'];
let problems = 0;
const fail = (msg) => { console.log(`MISSING: ${msg}`); problems++; };

// Video slug -> original file name in public/ (mirrors js/video-system.js)
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

const REQUIRED_ATTRS = ['autoplay', 'muted', 'loop', 'playsinline', 'preload="none"', 'aria-hidden="true"', 'tabindex="-1"'];
const VALID_MODES = new Set(['hero', 'background', 'contained', 'accent']);

for (const f of files) {
  const html = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

  const refs = [...html.matchAll(/(?:src|href|poster)="([^"#][^"]*)"/g)]
    .map(m => m[1])
    .filter(u => !/^(https?:|mailto:|tel:|wa\.me)/.test(u))
    .filter(u => !u.startsWith('[')); // business placeholders, not assets
  for (const r of refs) {
    if (!existsSync(new URL(`../${r}`, import.meta.url))) fail(`${f} -> ${r}`);
  }

  for (const m of html.matchAll(/<video\b[^>]*>/g)) {
    const tag = m[0];
    if (!tag.includes('data-video=')) continue;
    const slug = (tag.match(/data-video="([^"]+)"/) || [])[1];
    if (!slug) { fail(`${f} -> <video> missing data-video`); continue; }
    if (!ORIGINALS[slug]) fail(`${f} -> unknown video slug "${slug}"`);

    const mode = (tag.match(/data-mode="([^"]+)"/) || [])[1];
    if (!mode || !VALID_MODES.has(mode)) fail(`${f} -> video "${slug}" has invalid data-mode "${mode}"`);

    for (const attr of REQUIRED_ATTRS) {
      if (!tag.includes(attr)) fail(`${f} -> video "${slug}" missing ${attr}`);
    }
    if (tag.includes('<source')) fail(`${f} -> video "${slug}" must ship without <source> (JS attaches lazily)`);

    // Generated assets: poster stills + compressed web/mobile variants.
    for (const p of [
      `public/posters/${slug}.jpg`,
      `public/posters/${slug}.webp`,
      `public/web/${slug}.mp4`,
      `public/web/${slug}.webm`,
      `public/web/${slug}.sm.mp4`,
    ]) {
      if (!existsSync(new URL(`../${p}`, import.meta.url))) fail(`${f} -> ${p}`);
    }
    if (ORIGINALS[slug]) {
      const original = `public/${encodeURIComponent(ORIGINALS[slug]).replace(/%2F/g, '/')}`;
      if (!existsSync(new URL(`../${original}`, import.meta.url))) fail(`${f} -> ${original}`);
    }
  }
}

for (const slug of Object.keys(ORIGINALS)) {
  for (const p of [`public/posters/${slug}.jpg`, `public/posters/${slug}.webp`]) {
    if (!existsSync(new URL(`../${p}`, import.meta.url))) fail(`asset -> ${p}`);
  }
}

console.log(problems ? `${problems} problem(s) found` : 'All local asset references resolve');
process.exit(problems ? 1 : 0);
