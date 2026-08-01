/* Dashboard: quick links CRUD, clipboard sync (3s poll), recent files. */
(function () {
  "use strict";

  var linksGrid = document.getElementById("links-grid");
  var clipboardArea = document.getElementById("clipboard");
  var clipStatus = document.getElementById("clip-status");
  var recentFiles = document.getElementById("recent-files");
  var linkModal = document.getElementById("link-modal");
  var linkForm = document.getElementById("link-form");

  /* ---------- Quick links ---------- */

  function renderLinks(links) {
    linksGrid.textContent = "";
    if (links.length === 0) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No links yet — add your most-used sites.";
      linksGrid.appendChild(empty);
      return;
    }
    links.forEach(function (link) {
      var tile = document.createElement("a");
      tile.className = "link-tile";
      tile.href = link.url;
      tile.target = "_blank";
      tile.rel = "noopener noreferrer";

      var icon = document.createElement("span");
      icon.className = "link-tile__icon";
      icon.textContent = link.icon || "🔗";
      var title = document.createElement("span");
      title.className = "link-tile__title";
      title.textContent = link.title;

      var remove = document.createElement("button");
      remove.className = "link-tile__remove";
      remove.type = "button";
      remove.setAttribute("aria-label", "Remove " + link.title);
      remove.textContent = "✕";
      remove.addEventListener("click", async function (event) {
        event.preventDefault();
        event.stopPropagation();
        try {
          await window.API.del("/api/links/" + link.id);
          loadLinks();
        } catch (err) {
          window.UI.toast(err.message || "Couldn't remove link", true);
        }
      });

      tile.appendChild(icon);
      tile.appendChild(title);
      tile.appendChild(remove);
      linksGrid.appendChild(tile);
    });
  }

  async function loadLinks() {
    try {
      renderLinks(await window.API.get("/api/links"));
    } catch (err) {
      if (err.code !== "unauthorized") window.UI.toast("Couldn't load links", true);
    }
  }

  document.getElementById("add-link").addEventListener("click", function () {
    linkForm.reset();
    linkModal.showModal();
  });

  document.getElementById("edit-links").addEventListener("click", function () {
    linksGrid.classList.toggle("is-editing");
  });

  linkModal.addEventListener("close", async function () {
    if (linkModal.returnValue !== "save") return;
    try {
      await window.API.post("/api/links", {
        title: document.getElementById("link-title").value,
        url: document.getElementById("link-url").value,
        icon: document.getElementById("link-icon").value || null,
      });
      loadLinks();
    } catch (err) {
      window.UI.toast(err.message || "Couldn't save link", true);
    }
  });

  /* ---------- Clipboard sync ---------- */

  var clipRev = -1;
  var dirty = false;
  var saveTimer = null;
  var pollTimer = null;

  function setClipStatus(message) { clipStatus.textContent = message || ""; }

  async function pollClipboard() {
    if (dirty) return; // don't clobber local edits mid-typing
    try {
      var data = await window.API.get("/api/clipboard?since=" + clipRev);
      if (data.unchanged) return;
      clipRev = data.rev;
      if (document.activeElement !== clipboardArea) {
        clipboardArea.value = data.content;
      }
      setClipStatus("Synced " + new Date(data.updatedAt || Date.now()).toLocaleTimeString());
    } catch (err) {
      /* transient poll errors are silent */
    }
  }

  async function saveClipboard() {
    var content = clipboardArea.value;
    try {
      var data = await window.API.put("/api/clipboard", { content: content, rev: clipRev });
      clipRev = data.rev;
      dirty = false;
      setClipStatus("Saved");
    } catch (err) {
      if (err.code === "conflict" && err.data) {
        clipRev = err.data.rev;
        setClipStatus("Updated on another device — merged below");
        clipboardArea.value = err.data.content +
          (content && content !== err.data.content ? "\n---\n" + content : "");
        dirty = true;
        scheduleSave();
      } else if (err.code !== "unauthorized") {
        setClipStatus("Couldn't save — will retry");
        window.setTimeout(saveClipboard, 3000);
      }
    }
  }

  function scheduleSave() {
    dirty = true;
    setClipStatus("Typing…");
    if (saveTimer !== null) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveClipboard, 800);
  }

  clipboardArea.addEventListener("input", scheduleSave);

  function startPolling() {
    if (pollTimer !== null) return;
    pollTimer = window.setInterval(pollClipboard, 3000);
  }

  function stopPolling() {
    if (pollTimer !== null) {
      window.clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopPolling();
    else { pollClipboard(); startPolling(); }
  });

  /* ---------- Recent files ---------- */

  async function loadRecent() {
    try {
      var data = await window.API.get("/api/files");
      var files = data.files.slice(0, 5);
      recentFiles.textContent = "";
      if (files.length === 0) {
        var empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "Nothing uploaded yet.";
        recentFiles.appendChild(empty);
        return;
      }
      files.forEach(function (file) {
        var row = document.createElement("div");
        row.className = "file-row";

        var icon = document.createElement("span");
        icon.className = "file-row__icon";
        icon.textContent = window.UI.fileIcon(file.mime);

        var meta = document.createElement("div");
        meta.className = "file-row__meta";
        var name = document.createElement("div");
        name.className = "file-row__name";
        name.textContent = file.name;
        var sub = document.createElement("div");
        sub.className = "file-row__sub";
        sub.textContent = window.UI.formatBytes(file.size) + " · " +
          window.UI.formatDate(file.createdAt);
        meta.appendChild(name);
        meta.appendChild(sub);

        var actions = document.createElement("div");
        actions.className = "file-row__actions";
        var download = document.createElement("a");
        download.className = "icon-btn";
        download.href = "/api/files/" + file.id + "/content?disposition=attachment";
        download.setAttribute("aria-label", "Download " + file.name);
        download.textContent = "⬇";
        actions.appendChild(download);

        row.appendChild(icon);
        row.appendChild(meta);
        row.appendChild(actions);
        recentFiles.appendChild(row);
      });
    } catch (err) {
      /* 401 redirects handled by api.js */
    }
  }

  /* ---------- Sign out ---------- */

  document.getElementById("logout-btn").addEventListener("click", async function () {
    try { await window.API.post("/api/auth/logout"); } catch (ignored) {}
    window.location.href = "/login.html";
  });

  /* ---------- Boot ---------- */
  loadLinks();
  loadRecent();
  pollClipboard();
  startPolling();
})();
