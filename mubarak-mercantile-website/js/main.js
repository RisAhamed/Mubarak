// ============================================================
// MUBARAK MERCANTILE — shared behaviour
// ============================================================

document.documentElement.classList.add('js');

document.addEventListener('DOMContentLoaded', () => {

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ---- Mobile nav toggle ---- */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  const overlay = document.querySelector('.nav-overlay');
  const header = document.querySelector('.site-header');

  function openMenu() {
    links.classList.add('open');
    toggle.classList.add('active');
    header.classList.add('menu-open');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    toggle.setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    links.classList.remove('open');
    toggle.classList.remove('active');
    header.classList.remove('menu-open');
    if (overlay) overlay.classList.remove('show');
    document.body.style.overflow = '';
    toggle.setAttribute('aria-expanded', 'false');
  }

  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.contains('open') ? closeMenu() : openMenu();
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
    if (overlay) overlay.addEventListener('click', closeMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu();
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth > 900) closeMenu();
    });
  }

  /* ---- Sticky header: transparent -> solid cream after scroll ---- */
  if (header) {
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---- Scroll reveal (staggered within grids) ---- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 70}ms`;
      io.observe(el);
    });
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ---- Decorative video system + hero fallback chain ----
     Hero card plays the video; the WebGL scene only starts if that source
     fails, and the poster stays when motion is suppressed. Every other
     video is registered here so exactly one plays at a time. ---- */
  const heroScene = document.getElementById('hero-scene');
  const startWebGL = () =>
    import('./spice-scene.js')
      .then(({ initHeroScene }) => initHeroScene(heroScene))
      .catch(() => {});
  const loadVideos = () => import('./video-system.js');

  if (heroScene) {
    loadVideos()
      .then((videos) => {
        videos.initVideos();
        return videos.initHeroVideo(heroScene);
      })
      .then((result) => { if (result === 'failed') startWebGL(); })
      .catch(() => startWebGL());
  } else {
    loadVideos().then((videos) => videos.initVideos()).catch(() => {});
  }

  /* ---- Product category cards: gentle 3D tilt (desktop, fine pointer) ---- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.cat-card, .product-card').forEach(card => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transition = 'transform .12s ease-out';
        card.style.transform = `scale(1.02) rotateX(${(-y * 4).toFixed(2)}deg) rotateY(${(x * 4).toFixed(2)}deg)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transition = 'transform .45s cubic-bezier(.2,.8,.2,1)';
        card.style.transform = '';
      });
    });
  }

  /* ---- Scroll-linked 3D tilt: hero scene leans gently as you scroll ---- */
  const heroSceneEl = document.getElementById('hero-scene');
  if (heroSceneEl && !reduceMotion) {
    let ticking = false;
    const tilt = () => {
      ticking = false;
      const r = heroSceneEl.getBoundingClientRect();
      if (r.bottom < -80 || r.top > window.innerHeight + 80) return;
      const p = (window.innerHeight - r.top) / (window.innerHeight + r.height) - 0.5;
      heroSceneEl.style.transform =
        `perspective(1100px) rotateY(${(p * 7).toFixed(2)}deg) rotateX(${(-p * 3.5).toFixed(2)}deg)`;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(tilt); }
    }, { passive: true });
    tilt();
  }

  /* ---- Hero stats: count-up + pop when the hero settles ---- */
  const heroRoute = document.querySelector('.hero-route');
  if (heroRoute && 'IntersectionObserver' in window) {
    const stats = heroRoute.querySelectorAll('.stat');
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      stats.forEach((s, i) => {
        setTimeout(() => s.classList.add('pop'), i * 140);
        const num = s.querySelector('[data-count]');
        if (!num) return;
        const target = +num.dataset.count;
        const t0 = performance.now();
        const dur = 1200;
        const step = (now) => {
          const p = Math.min((now - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          num.textContent = Math.round(target * eased);
          if (p < 1) requestAnimationFrame(step);
        };
        setTimeout(() => requestAnimationFrame(step), i * 140);
      });
    }, { threshold: 0.4 });
    io.observe(heroRoute);
  } else if (heroRoute) {
    heroRoute.querySelectorAll('[data-count]').forEach(num => {
      num.textContent = num.dataset.count;
    });
  }

  /* ---- Quality timeline: dot fills step-by-step as it enters view ---- */
  const qTimeline = document.querySelector('.q-timeline');
  if (qTimeline && 'IntersectionObserver' in window) {
    const steps = qTimeline.querySelectorAll('.q-step');
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        steps.forEach((step, i) => {
          setTimeout(() => step.classList.add('in'), 200 + i * 160);
        });
        io.disconnect();
      }
    }, { threshold: 0.2 });
    io.observe(qTimeline);
  } else if (qTimeline) {
    qTimeline.querySelectorAll('.q-step').forEach(s => s.classList.add('in'));
  }

  /* ---- Export reach: gold line-art world map + animated routes ---- */
  const mapWrap = document.getElementById('export-map');
  if (mapWrap) {
    // Equirectangular land grid, encoded as [row][startCol,endCol] ranges
    const LAND = [
      [[8,14],[26,31],[40,60]],
      [[1,16],[25,32],[38,62]],
      [[1,18],[26,31],[36,63]],
      [[2,19],[27,30],[33,37],[38,63]],
      [[3,20],[29,30],[33,38],[54,54]],
      [[9,21],[29,30],[32,39],[53,55]],
      [[10,22],[31,39],[40,58]],
      [[10,22],[28,38],[39,45],[46,56]],
      [[11,21],[28,37],[39,43],[46,57]],
      [[12,16],[21,21],[28,37],[40,43],[46,49],[50,54]],
      [[14,17],[28,38],[41,41],[46,48],[50,54]],
      [[15,24],[29,38],[47,47],[50,53],[55,55]],
      [[18,25],[29,38],[47,47],[51,56]],
      [[18,26],[29,38],[51,60]],
      [[19,26],[30,38],[51,60]],
      [[19,26],[30,38],[50,57]],
      [[19,25],[30,37],[50,57]],
      [[20,25],[31,36],[50,56]],
      [[20,24],[31,35],[51,55]],
      [[20,24],[32,34],[62,62]],
      [[21,23],[61,63]],
      [[21,23]],
      [[21,22]],
      [[21,21]],
    ];
    const CELL = 10, W = 640, H = 280;
    const px = (c) => c * CELL + CELL / 2;
    const py = (r) => r * CELL + CELL / 2;

    let dots = '';
    LAND.forEach((ranges, r) => {
      ranges.forEach(([a, b]) => {
        for (let c = a; c <= b; c++) {
          dots += `<circle class="map-dot land" cx="${px(c)}" cy="${py(r)}" r="2.1"/>`;
        }
      });
    });

    // India origin + selected global markers (decorative)
    const origin = { x: px(47.5), y: py(9) };
    const dests = [
      { x: px(41.5), y: py(9) },   // Middle East
      { x: px(29.5), y: py(4.5) }, // Europe
      { x: px(21), y: py(6) },     // North America
      { x: px(52), y: py(12) },    // Southeast Asia
      { x: px(53), y: py(15) },    // Australia
    ];

    let routes = '', markers = '';
    dests.forEach((d) => {
      const cx = (origin.x + d.x) / 2;
      const cy = Math.min(origin.y, d.y) - 42;
      routes += `<path class="map-route" d="M${origin.x},${origin.y} Q${cx},${cy} ${d.x},${d.y}"/>`;
      markers += `<circle class="map-marker-pulse" cx="${d.x}" cy="${d.y}" r="6"/>`;
      markers += `<circle class="map-marker" cx="${d.x}" cy="${d.y}" r="4"/>`;
    });

    mapWrap.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="presentation">
        <g>${dots}</g>
        <g>${routes}</g>
        <g>${markers}</g>
        <circle class="map-origin" cx="${origin.x}" cy="${origin.y}" r="5"/>
      </svg>`;

    // Animate routes/markers only once the section enters the viewport
    const reachSection = document.getElementById('export-reach');
    const startMap = () => {
      mapWrap.querySelectorAll('.map-route').forEach(r => r.classList.add('animate'));
      mapWrap.querySelectorAll('.map-marker-pulse').forEach(m => m.classList.add('animate'));
      // 3D pop-in: origin first, then each destination marker staggered
      const origin = mapWrap.querySelector('.map-origin');
      if (origin) setTimeout(() => origin.classList.add('pop'), 350);
      mapWrap.querySelectorAll('.map-marker').forEach((m, i) => {
        setTimeout(() => m.classList.add('pop'), 550 + i * 170);
      });
    };
    if (reachSection && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          startMap();
          io.disconnect();
        }
      }, { threshold: 0.3 });
      io.observe(reachSection);
    } else {
      startMap();
    }
  }

  /* ---- Heritage collage: scroll-linked 3D depth ---- */
  const collage = document.getElementById('heritage-collage');
  if (collage && !reduceMotion) {
    const items = collage.querySelectorAll('.collage-item');
    const factors = [0.05, 0.09, 0.13];
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = collage.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      const progress = (window.innerHeight - r.top) / (window.innerHeight + r.height) - 0.5;
      items.forEach((el, i) => {
        const depth = (i + 1) * 14;
        el.style.transform =
          `translateY(${(progress * 46 * factors[i] * 3).toFixed(1)}px)` +
          ` translateZ(${depth.toFixed(0)}px)` +
          ` rotateX(${(progress * -5).toFixed(2)}deg)` +
          ` rotateY(${(progress * 7).toFixed(2)}deg)`;
      });
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---- Final CTA: word-stagger pop + section reveal ---- */
  const finalCta = document.querySelector('.final-cta');
  if (finalCta && 'IntersectionObserver' in window) {
    const h2 = finalCta.querySelector('h2');
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      finalCta.classList.add('in');
      if (h2) {
        h2.querySelectorAll('.w').forEach((w, i) => {
          w.style.transitionDelay = `${i * 55}ms`;
        });
        h2.classList.add('in');
      }
    }, { threshold: 0.35 });
    io.observe(finalCta);
  } else if (finalCta) {
    finalCta.classList.add('in');
    const h2 = finalCta.querySelector('h2');
    if (h2) h2.classList.add('in');
  }

  /* ---- Final CTA: slow spice particle drift (2D canvas, 15% opacity) ---- */
  const ctaCanvas = document.getElementById('cta-particles');
  if (ctaCanvas) {
    const ctx = ctaCanvas.getContext('2d');
    let particles = [], raf = null, running = false;

    function sizeCanvas() {
      const r = ctaCanvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      ctaCanvas.width = r.width * dpr;
      ctaCanvas.height = r.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      const r = ctaCanvas.parentElement.getBoundingClientRect();
      const count = Math.min(60, Math.floor(r.width / 22));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * r.width,
        y: Math.random() * r.height,
        r: 0.8 + Math.random() * 2.4,
        speed: 0.08 + Math.random() * 0.22,
        phase: Math.random() * Math.PI * 2,
        gold: Math.random() > 0.3,
      }));
    }

    function draw(t) {
      const r = ctaCanvas.parentElement.getBoundingClientRect();
      ctx.clearRect(0, 0, r.width, r.height);
      for (const p of particles) {
        p.y -= p.speed;
        p.x += Math.sin(t / 2400 + p.phase) * 0.12;
        if (p.y < -6) { p.y = r.height + 6; p.x = Math.random() * r.width; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold ? '#E8A317' : '#B42318';
        ctx.fill();
      }
    }

    function loop(t) {
      if (!running) return;
      draw(t);
      raf = requestAnimationFrame(loop);
    }

    function setRunning(run) {
      if (reduceMotion) {
        if (!running) { draw(0); } // single static frame
        return;
      }
      if (run === running) return;
      running = run;
      if (run) { sizeCanvas(); seed(); raf = requestAnimationFrame(loop); }
      else if (raf) { cancelAnimationFrame(raf); raf = null; }
    }

    sizeCanvas();
    seed();
    if (reduceMotion) {
      draw(0);
    } else if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        setRunning(entries[0].isIntersecting);
      }, { threshold: 0.05 }).observe(ctaCanvas);
      window.addEventListener('resize', () => { sizeCanvas(); seed(); }, { passive: true });
    } else {
      setRunning(true);
    }
  }

  /* ---- Product filter + search (Products page) ---- */
  const filterBar = document.querySelector('.filter-bar');
  if (filterBar) {
    const chips = filterBar.querySelectorAll('.chip');
    const search = filterBar.querySelector('.search-input');
    const cards = document.querySelectorAll('[data-product]');

    function applyFilter() {
      const activeChip = filterBar.querySelector('.chip.active');
      const cat = activeChip ? activeChip.dataset.filter : 'all';
      const term = (search && search.value ? search.value : '').trim().toLowerCase();

      cards.forEach(card => {
        const matchesCat = cat === 'all' || card.dataset.category === cat;
        const matchesTerm = !term || card.dataset.name.toLowerCase().includes(term);
        card.style.display = (matchesCat && matchesTerm) ? '' : 'none';
      });
    }

    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        chips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        applyFilter();
      });
    });
    if (search) search.addEventListener('input', applyFilter);
  }

  /* ---- "Enquire Now" -> prefill contact form product field ---- */
  document.querySelectorAll('[data-enquire]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productName = btn.dataset.enquire;
      sessionStorage.setItem('mm_product_interest', productName);
      // If on products page, navigate to contact; if already on contact, just fill.
      const productField = document.getElementById('productInterest');
      if (productField) {
        e.preventDefault();
        productField.value = productName;
        document.getElementById('contact-form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
        productField.focus();
      }
    });
  });

  /* ---- On contact page load, apply any stored product interest ---- */
  const productField = document.getElementById('productInterest');
  if (productField) {
    const stored = sessionStorage.getItem('mm_product_interest');
    if (stored) {
      productField.value = stored;
      sessionStorage.removeItem('mm_product_interest');
    }
  }

  /* ---- Enquiry form submit (front-end only — wire to backend / form service) ---- */
  const enquiryForm = document.getElementById('enquiryForm');
  if (enquiryForm) {
    enquiryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      enquiryForm.style.display = 'none';
      const success = document.getElementById('formSuccess');
      if (success) success.classList.add('show');
    });
  }

  /* ---- Footer year ---- */
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = new Date().getFullYear();
  });

});
