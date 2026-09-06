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

  // Underline tabs (owner app page).
  document.querySelectorAll('[data-tabs]').forEach(function (root) {
    var buttons = root.querySelectorAll('[role="tab"]');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) {
          var on = b === btn;
          b.setAttribute('aria-selected', on ? 'true' : 'false');
          var panel = document.getElementById(b.getAttribute('aria-controls'));
          if (panel) panel.hidden = !on;
        });
      });
    });
  });

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
})();
