/* Shared UI primitives: toasts, confirm, formatting, reveal animations. */
(function () {
  "use strict";

  var toastHost = null;

  function ensureToastHost() {
    if (toastHost === null) {
      toastHost = document.createElement("div");
      toastHost.className = "toasts";
      toastHost.setAttribute("aria-live", "polite");
      document.body.appendChild(toastHost);
    }
    return toastHost;
  }

  function toast(message, isError) {
    var el = document.createElement("div");
    el.className = "toast" + (isError ? " toast--error" : "");
    el.textContent = message;
    ensureToastHost().appendChild(el);
    window.setTimeout(function () { el.remove(); }, 4000);
  }

  function formatBytes(size) {
    if (typeof size !== "number" || size < 0) return "";
    var units = ["B", "KB", "MB", "GB"];
    var value = size;
    var i = 0;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
    return (i === 0 ? value : value.toFixed(1)) + " " + units[i];
  }

  function formatDate(ts) {
    if (typeof ts !== "number") return "";
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  function formatCountdown(untilTs) {
    var ms = untilTs - Date.now();
    if (ms <= 0) return "expired";
    var minutes = Math.floor(ms / 60000);
    if (minutes < 60) return minutes + "m left";
    var hours = Math.floor(minutes / 60);
    if (hours < 48) return hours + "h " + (minutes % 60) + "m left";
    return Math.floor(hours / 24) + "d left";
  }

  function fileIcon(mime) {
    if (typeof mime !== "string") return "📄";
    if (mime.indexOf("image/") === 0) return "🖼️";
    if (mime === "application/pdf") return "📕";
    if (mime.indexOf("video/") === 0) return "🎞️";
    if (mime.indexOf("audio/") === 0) return "🎵";
    if (mime.indexOf("text/") === 0) return "📝";
    if (mime.indexOf("zip") !== -1 || mime.indexOf("compressed") !== -1) return "🗜️";
    if (mime.indexOf("sheet") !== -1 || mime.indexOf("csv") !== -1) return "📊";
    return "📄";
  }

  function revealAll() {
    var items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.05 });
    items.forEach(function (el) { observer.observe(el); });
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard");
      return true;
    } catch (err) {
      toast("Couldn't copy — long-press to copy manually", true);
      return false;
    }
  }

  window.UI = {
    toast: toast,
    formatBytes: formatBytes,
    formatDate: formatDate,
    formatCountdown: formatCountdown,
    fileIcon: fileIcon,
    revealAll: revealAll,
    copyText: copyText,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", revealAll);
  } else {
    revealAll();
  }
})();
