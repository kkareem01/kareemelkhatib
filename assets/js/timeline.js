/* ============================================================
   Life timeline — Kareem Elkhatib
   Data-driven: edit the MILESTONES array below to add/reorder
   life events. Everything else (markup, scroll animation, the
   sticky crossfading year, the drawing progress line) is wired
   up automatically. Respects prefers-reduced-motion.
   ============================================================ */
(function () {
  "use strict";

  /* ------------------------------------------------------------
     YOUR LIFE GOES HERE.
     One object per milestone, oldest → newest (top → bottom).

       year  : string shown big in the rail + small on the card
       tag   : short category label (Life · Engineering · Business · Photography)
       title : the headline of the moment
       text  : (optional) a sentence or two of detail
       img   : (optional) "assets/img/xxxx.jpg" — shows a framed image

     These are PLACEHOLDERS — swap them for the real story.
     ------------------------------------------------------------ */
  var MILESTONES = [
    {
      year: "2003",
      tag: "Life",
      title: "Born in Atlanta, Georgia",
      text: "Where the whole story starts — and still home base today."
    },
    {
      year: "2017",
      tag: "Life",
      title: "Picked up a camera for the first time",
      text: "The early obsession with framing a moment that would later become a craft."
    },
    {
      year: "2020",
      tag: "Engineering",
      title: "Started at the University of Georgia",
      text: "Began the B.S. in Electrical Engineering — the analytical backbone for everything that followed."
    },
    {
      year: "2022",
      tag: "Photography",
      title: "First paid wedding shoot",
      text: "Turned the hobby into a service — cinematic engagement and wedding work."
    },
    {
      year: "2023",
      tag: "Business",
      title: "Founded Local Service Marketers",
      text: "AI-powered web design & SEO that gets home-service businesses more booked jobs."
    },
    {
      year: "2024",
      tag: "Engineering",
      title: "Graduated — B.S. Electrical Engineering",
      text: "Degree in hand, with a business and a portfolio already running."
    },
    {
      year: "2026",
      tag: "Life",
      title: "Building, running & capturing — all at once",
      text: "Engineer, founder, and filmmaker in parallel. The next chapter is being written."
    }
  ];

  var mount = document.getElementById("timeline");
  if (!mount) return;

  var prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Render milestones from data ---------- */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  mount.innerHTML = MILESTONES.map(function (m, i) {
    var media = m.img
      ? '<div class="tl-item__media"><div class="frame"><img src="' +
        esc(m.img) + '" alt="' + esc(m.title) + '" loading="lazy" /></div></div>'
      : "";
    return (
      '<li class="tl-item" data-year="' + esc(m.year) + '" style="--idx:' + i + '">' +
        '<div class="tl-item__marker" aria-hidden="true"><span class="tl-item__dot"></span></div>' +
        '<div class="tl-item__card">' +
          '<p class="tl-item__year">' + esc(m.year) + '</p>' +
          (m.tag ? '<p class="tl-item__tag">' + esc(m.tag) + '</p>' : "") +
          '<h3 class="tl-item__title">' + esc(m.title) + '</h3>' +
          (m.text ? '<p class="tl-item__text">' + esc(m.text) + '</p>' : "") +
          media +
        '</div>' +
      '</li>'
    );
  }).join("");

  var items = Array.prototype.slice.call(mount.querySelectorAll(".tl-item"));
  var yearEl = document.querySelector("[data-timeline-year]");
  var fillEl = document.querySelector("[data-timeline-fill]");

  // Seed the rail year with the first milestone.
  if (yearEl && items.length) yearEl.textContent = items[0].getAttribute("data-year");

  /* ---------- Reduced motion / no IO: show everything, bail ---------- */
  if (prefersReduced || !("IntersectionObserver" in window)) {
    items.forEach(function (el) { el.classList.add("is-visible", "is-active"); });
    if (fillEl) fillEl.style.transform = "scaleY(1)";
    return;
  }

  /* ---------- Reveal each card as it enters view ---------- */
  var revealObs = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          revealObs.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -12% 0px", threshold: 0.15 }
  );
  items.forEach(function (el) { revealObs.observe(el); });

  /* ---------- Active milestone = the one crossing screen center.
     Drives the sticky giant year (crossfade) + the active dot. ---------- */
  var current = null;
  function setActive(el) {
    if (!el || el === current) return;
    if (current) current.classList.remove("is-active");
    current = el;
    el.classList.add("is-active");
    if (yearEl) {
      var y = el.getAttribute("data-year");
      if (yearEl.textContent !== y) {
        yearEl.textContent = y;
        yearEl.classList.remove("is-swap");
        // force reflow so the swap animation restarts each change
        void yearEl.offsetWidth;
        yearEl.classList.add("is-swap");
      }
    }
  }

  var activeObs = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) setActive(e.target);
      });
    },
    // thin focus band across the vertical middle of the viewport
    { rootMargin: "-48% 0px -48% 0px", threshold: 0 }
  );
  items.forEach(function (el) { activeObs.observe(el); });

  /* ---------- Progress line draws as the section scrolls past center ---------- */
  var ticking = false;
  function updateProgress() {
    ticking = false;
    if (!fillEl) return;
    var rect = mount.getBoundingClientRect();
    var mid = window.innerHeight * 0.5;
    var p = (mid - rect.top) / (rect.height || 1);
    p = Math.max(0, Math.min(1, p));
    fillEl.style.transform = "scaleY(" + p.toFixed(4) + ")";
  }
  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateProgress);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  updateProgress();
})();
