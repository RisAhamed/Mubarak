// ============================================================
// MUBARAK MERCANTILE — shared behaviour
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  /* ---- Mobile nav toggle ---- */
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  const overlay = document.querySelector('.nav-overlay');

  function openMenu() {
    links.classList.add('open');
    toggle.classList.add('active');
    if (overlay) overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
    toggle.setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    links.classList.remove('open');
    toggle.classList.remove('active');
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

  /* ---- Scroll reveal ---- */
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
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }

  /* ---- Sticky header shadow on scroll ---- */
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.style.boxShadow = window.scrollY > 8 ? '0 4px 20px rgba(11,31,58,0.06)' : 'none';
    });
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
