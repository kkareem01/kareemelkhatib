/* Nav: mobile toggle + scrolled state.
   Active-link highlighting is handled per-page in markup via
   aria-current="page" so it works without JS. This only adds
   the mobile menu and the hairline-on-scroll affordance. */
(function () {
  "use strict";

  var nav = document.querySelector(".nav");
  if (!nav) return;

  var toggle = nav.querySelector(".nav__toggle");
  var links = nav.querySelector(".nav__links");

  function closeMenu() {
    nav.classList.remove("is-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    // Close after choosing a destination
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) closeMenu();
    });
    // Close on escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  // Hairline border appears once the page is scrolled
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
})();
