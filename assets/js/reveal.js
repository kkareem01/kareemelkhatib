/* Scroll reveals: fade-up elements with .reveal as they enter view.
   One consistent effect, applied site-wide. Respects reduced-motion
   (CSS already forces .reveal visible there, so we simply skip). */
(function () {
  "use strict";

  var prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  // Fallback: no observer support → show everything immediately.
  if (prefersReduced || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.12 }
  );

  items.forEach(function (el) { observer.observe(el); });
})();
