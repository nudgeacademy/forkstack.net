(function () {
  "use strict";

  // Mark JS as enabled so CSS can gate the reveal animation behind it
  // (page is fully visible by default when JS is disabled).
  document.documentElement.classList.add("js");

  // ---------- Sticky nav border on scroll ----------
  var nav = document.querySelector(".nav");
  function onScroll() {
    if (window.scrollY > 8) {
      nav.classList.add("scrolled");
    } else {
      nav.classList.remove("scrolled");
    }
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // ---------- Mobile nav toggle ----------
  var navToggle = document.getElementById("navToggle");
  var navMobile = document.getElementById("navMobile");

  function closeMobileNav() {
    navToggle.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
    navMobile.classList.remove("is-open");
  }

  navToggle.addEventListener("click", function () {
    var isOpen = navToggle.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
    navMobile.classList.toggle("is-open", isOpen);
  });

  navMobile.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeMobileNav);
  });

  // Close the dropdown panel when clicking outside the pill
  document.addEventListener("click", function (e) {
    if (navMobile.classList.contains("is-open") && !e.target.closest(".nav__pill")) {
      closeMobileNav();
    }
  });

  // ---------- Scrollspy: highlight the nav link for the section nearest the top ----------
  var spyLinks = Array.prototype.slice.call(
    document.querySelectorAll('.nav__links a[href^="#"]')
  );
  var spyMap = {};
  spyLinks.forEach(function (link) {
    spyMap[link.getAttribute("href").slice(1)] = link;
  });
  var spySections = Object.keys(spyMap)
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);

  if ("IntersectionObserver" in window && spySections.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            spyLinks.forEach(function (l) { l.classList.remove("active"); });
            spyMap[entry.target.id].classList.add("active");
          }
        });
      },
      // A narrow band near the top of the viewport: whichever section
      // occupies it is the active one.
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 }
    );
    spySections.forEach(function (section) { spy.observe(section); });
  }

  // ---------- Scroll-reveal via IntersectionObserver ----------
  var revealEls = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  if ("IntersectionObserver" in window && revealEls.length) {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );

    // Stagger siblings within the same parent container.
    var staggerCounters = new WeakMap();
    revealEls.forEach(function (el) {
      var parent = el.parentElement;
      var count = staggerCounters.get(parent) || 0;
      el.style.transitionDelay = (count * 40) + "ms";
      staggerCounters.set(parent, count + 1);
      observer.observe(el);
    });
  } else {
    // No IntersectionObserver support: show everything immediately.
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }
})();
