/* ForkStack site behaviour. Everything here is an enhancement — every page
 * renders and reads correctly with this file blocked. */
(function () {
  'use strict';

  // Header gains a surface once the page has moved off the hero.
  var header = document.querySelector('.site-header');
  if (header) {
    // The header also inverts while it sits over one of the ink bands, so the
    // logo and the links stay legible instead of punching a bright hole in it.
    var bands = document.querySelectorAll('.dark');
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 40);
      var edge = header.offsetHeight - 1;
      var over = false;
      for (var i = 0; i < bands.length; i++) {
        var r = bands[i].getBoundingClientRect();
        if (r.top <= edge && r.bottom > 0) { over = true; break; }
      }
      header.classList.toggle('on-dark', over);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
  }

  // Theme switch. Light is the default; the choice is remembered in this
  // browser only. The <head> applies a saved choice before first paint.
  var themeBtn = document.querySelector('.theme-toggle');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var applyTheme = function (dark) {
    if (dark) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    if (themeMeta) themeMeta.setAttribute('content', dark ? '#0C0C0B' : '#FAF8F5');
    if (themeBtn) {
      themeBtn.setAttribute('aria-pressed', dark ? 'true' : 'false');
      themeBtn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
  };
  applyTheme(document.documentElement.getAttribute('data-theme') === 'dark');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var dark = document.documentElement.getAttribute('data-theme') !== 'dark';
      applyTheme(dark);
      try { localStorage.setItem('theme', dark ? 'dark' : 'light'); } catch (e) { /* private mode: not remembered */ }
    });
  }

  // Product dropdown in the desktop nav.
  var group = document.querySelector('.nav-group');
  if (group) {
    var trigger = group.querySelector('button');
    var close = function () {
      group.dataset.open = 'false';
      trigger.setAttribute('aria-expanded', 'false');
    };
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = group.dataset.open === 'true';
      group.dataset.open = open ? 'false' : 'true';
      trigger.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
    document.addEventListener('click', function (e) {
      if (!group.contains(e.target)) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  // Mobile sheet.
  var toggle = document.querySelector('.nav-toggle');
  var sheet = document.querySelector('.mobile-nav');
  if (toggle && sheet) {
    toggle.addEventListener('click', function () {
      var open = sheet.dataset.open === 'true';
      sheet.dataset.open = open ? 'false' : 'true';
      toggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      document.body.style.overflow = open ? '' : 'hidden';
    });
  }

  // Hero shot — the one animated element on the site. --p runs 0 to 1 as the
  // block travels up through the viewport; CSS turns that into a scale on the
  // frame and a rise on the caption. Left at 1 when the reader prefers less
  // motion, or when this file never runs.
  var shot = document.querySelector('[data-hero-shot]');
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (shot && !calm) {
    var queued = false;
    var measure = function () {
      queued = false;
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var top = shot.getBoundingClientRect().top;
      // 0 while the block's top is still low in the viewport, 1 once it has
      // risen past the header. Tuned so the whole move plays inside the first
      // ~300px of scroll rather than being half over at load.
      var p = (vh * 0.72 - top) / (vh * 0.62);
      shot.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(4));
    };
    var onMove = function () {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
  }

  // Demo walkthrough: mark the step the reader is actually looking at.
  var steps = document.querySelectorAll('.demo-body .step');
  var links = document.querySelectorAll('.demo-steps a[data-step]');
  if (steps.length && links.length && 'IntersectionObserver' in window) {
    var byId = {};
    links.forEach(function (a) { byId[a.dataset.step] = a; });
    var current = null;
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        if (id === current) return;
        current = id;
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        var active = byId[id];
        if (!active) return;
        active.setAttribute('aria-current', 'true');
        // Keep the active row visible in the sticky rail without moving the page.
        var rail = document.querySelector('.demo-steps');
        if (rail && rail.scrollHeight > rail.clientHeight) {
          var top = active.offsetTop - rail.clientHeight / 2;
          rail.scrollTo({ top: top, behavior: 'smooth' });
        }
      });
    }, { rootMargin: '-20% 0px -65% 0px' });
    steps.forEach(function (s) { observer.observe(s); });
  }

  /* ---------- Page motion ----------
   * All of it is safe to lose and all of it is off with reduced motion:
   *  - the home hero's load sequence;
   *  - a short fade as each block first comes on screen;
   *  - a section rail and a scroll meter on long pages. */
  var hero = document.querySelector('[data-hero]');

  // Scroll meter: a mint line under the header for the whole page.
  var meter = document.createElement('div');
  meter.className = 'scroll-meter';
  meter.setAttribute('aria-hidden', 'true');
  document.body.appendChild(meter);

  // Section rail, built from each section's eyebrow.
  var railSections = [];
  document.querySelectorAll('main > section:not(.hero)').forEach(function (s) {
    var eb = s.querySelector('.eyebrow');
    var label = eb ? eb.textContent.trim() : '';
    if (label && label.length < 32) railSections.push({ el: s, label: label });
  });
  var rail = null, railButtons = [];
  if (railSections.length >= 3) {
    rail = document.createElement('nav');
    rail.className = 'page-rail';
    rail.setAttribute('aria-label', 'Sections on this page');
    railSections.forEach(function (r) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = r.label;
      b.addEventListener('click', function () { r.el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth' }); });
      rail.appendChild(b);
      railButtons.push(b);
    });
    document.body.appendChild(rail);
  }

  var tickScroll = function () {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    meter.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, window.scrollY / max) : 0).toFixed(4) + ')';
    if (rail) {
      var mid = window.innerHeight * 0.4, active = -1;
      railSections.forEach(function (r, i) { if (r.el.getBoundingClientRect().top <= mid) active = i; });
      rail.classList.toggle('is-on', active >= 0);
      railButtons.forEach(function (b, i) { b.setAttribute('aria-current', i === active ? 'true' : 'false'); });
    }
  };
  tickScroll();
  window.addEventListener('scroll', tickScroll, { passive: true });
  window.addEventListener('resize', tickScroll);

  if (calm) return;

  // Home hero: arm the load sequence, then release it on the next frame so the
  // transitions run.
  if (hero) {
    hero.classList.add('hero-armed');
    var release = function () { requestAnimationFrame(function () { requestAnimationFrame(function () { hero.classList.add('is-ready'); }); }); };
    var first = hero.querySelector('.hero-desk img');
    if (first && !first.complete) {
      first.addEventListener('load', release, { once: true });
      first.addEventListener('error', release, { once: true });
      setTimeout(release, 900);
    } else {
      release();
    }
  }

  // Arrivals. Only marked once this script runs, so without it every block is
  // simply there.
  if ('IntersectionObserver' in window) {
    var targets = [
      '.section-head', '.split > *', '.narrow > *', '.wrap > h1', '.wrap > h2', '.wrap > p',
      '.stat-row > div', '.plat-bar', '.showcase-card', '.feat-item', '.grid-facts > li',
      '.row-4 > *', '.row-3 > *', '.row-2 > *', '.card', '.shot', '.table-scroll', '.deflist > div',
      '.accordion details', '.demo-body .step', '.app-tab', '.prose > *', '.diagram', '.stage-brochure',
      '.hero-shot', '.btn-row', '.phone-pair', '.window-grid > figure', '.device-figure'
    ];
    var seen = [];
    document.querySelectorAll(targets.map(function (t) { return 'main ' + t; }).join(', ') + ', .site-footer .cols > div').forEach(function (el) {
      if (hero && hero.contains(el)) return;
      for (var p = el.parentElement; p; p = p.parentElement) if (p.classList.contains('reveal')) return;
      el.classList.add('reveal');
      var i = 0;
      for (var s = el.previousElementSibling; s && i < 4; s = s.previousElementSibling) if (s.classList.contains('reveal')) i++;
      el.style.setProperty('--d', (i * 60) + 'ms');
      seen.push(el);
    });

    // Figures count up from zero the first time they arrive.
    var countUp = function (el) {
      var m = el.textContent.match(/^(\D*)(\d+)(\D*)$/);
      if (!m) return;
      var to = +m[2], t0 = performance.now();
      var step = function (t) {
        var k = Math.min(1, (t - t0) / 1100);
        el.textContent = m[1] + Math.round(to * (1 - Math.pow(1 - k, 3))) + m[3];
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        el.classList.add('is-in');
        el.querySelectorAll('.figure').forEach(countUp);
        // Once it has arrived, hand the block back to its own hover styles.
        setTimeout(function () { el.classList.remove('reveal', 'is-in'); el.style.removeProperty('--d'); }, 700 + (parseInt(el.style.getPropertyValue('--d'), 10) || 0));
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    seen.forEach(function (el) { io.observe(el); });
    document.documentElement.classList.add('motion');
  }
})();
