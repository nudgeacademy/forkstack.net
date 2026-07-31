(function () {
  "use strict";

  // Sticky nav elevation on scroll
  const nav = document.querySelector(".nav");
  function onScroll() {
    if (nav) {
      if (window.scrollY > 12) {
        nav.classList.add("scrolled");
      } else {
        nav.classList.remove("scrolled");
      }
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile drawer toggle
  document.addEventListener("DOMContentLoaded", function () {
    const navToggle = document.getElementById("navToggle");
    const navMobile = document.getElementById("navMobile");

    if (navToggle && navMobile) {
      function closeMobileNav() {
        navToggle.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navMobile.classList.remove("is-open");
      }

      navToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        const isOpen = navToggle.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
        navMobile.classList.toggle("is-open", isOpen);
      });

      // Auto close on link click
      navMobile.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", closeMobileNav);
      });

      // Auto close when clicking outside
      document.addEventListener("click", function (e) {
        if (navMobile.classList.contains("is-open") && !e.target.closest(".nav__pill")) {
          closeMobileNav();
        }
      });
    }
  });
})();
