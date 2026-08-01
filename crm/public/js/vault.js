/* Vault: uploads (drag-drop, picker, camera), list/search/tags, preview,
   rename/tag modal, share modal with QR. */
(function () {
  "use strict";

  var MAX_UPLOAD = 95 * 1024 * 1024;
  var INLINE_PREVIEW = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif", "application/pdf", "text/plain"];

  var dropzone = document.getElementById("dropzone");
  var uploadStatus = document.getElementById("upload-status");
  var fileList = document.getElementById("file-list");
  var searchInput = document.getElementById("search");
  var tagChips = document.getElementById("tag-chips");
  var loadMoreBtn = document.getElementById("load-more");

  var state = { q: "", tag: null, cursor: null, files: [], knownTags: [] };

  /* ---------- Upload ---------- */

  function setUploadStatus(message) { uploadStatus.textContent = message || ""; }

  async function uploadFiles(files) {
    var list = Array.prototype.slice.call(files);
    for (var i = 0; i < list.length; i++) {
      var file = list[i];
      if (file.size > MAX_UPLOAD) {
        window.UI.toast(file.name + " is over the 95MB limit", true);
        continue;
      }
      setUploadStatus("Uploading " + file.name + " (" + (i + 1) + "/" + list.length + ")…");
      try {
        await window.API.upload(file);
      } catch (err) {
        window.UI.toast((file.name || "File") + ": " + (err.message || "upload failed"), true);
      }
    }
    setUploadStatus("");
    if (list.length > 0) {
      window.UI.toast("Upload complete");
      refresh();
    }
  }

  ["dragover", "dragenter"].forEach(function (name) {
    dropzone.addEventListener(name, function (event) {
      event.preventDefault();
      dropzone.classList.add("is-over");
    });
  });
  ["dragleave", "drop"].forEach(function (name) {
    dropzone.addEventListener(name, function (event) {
      event.preventDefault();
      dropzone.classList.remove("is-over");
    });
  });
  dropzone.addEventListener("drop", function (event) {
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      uploadFiles(event.dataTransfer.files);
    }
  });

  var fileInput = document.getElementById("file-input");
  var cameraInput = document.getElementById("camera-input");
  document.getElementById("pick-files").addEventListener("click", function () { fileInput.click(); });
  document.getElementById("pick-camera").addEventListener("click", function () { cameraInput.click(); });
  fileInput.addEventListener("change", function () { uploadFiles(fileInput.files); fileInput.value = ""; });
  cameraInput.addEventListener("change", function () { uploadFiles(cameraInput.files); cameraInput.value = ""; });

  /* ---------- Listing ---------- */

  function buildQuery(cursor) {
    var params = new URLSearchParams();
    if (state.q) params.set("q", state.q);
    if (state.tag) params.set("tag", state.tag);
    if (cursor) params.set("cursor", String(cursor));
    var qs = params.toString();
    return "/api/files" + (qs ? "?" + qs : "");
  }

  async function refresh() {
    try {
      var data = await window.API.get(buildQuery(null));
      state.files = data.files;
      state.cursor = data.nextCursor;
      render();
    } catch (err) {
      if (err.code !== "unauthorized") window.UI.toast("Couldn't load files", true);
    }
  }

  loadMoreBtn.addEventListener("click", async function () {
    if (state.cursor === null) return;
    try {
      var data = await window.API.get(buildQuery(state.cursor));
      state.files = state.files.concat(data.files);
      state.cursor = data.nextCursor;
      render();
    } catch (err) {
      window.UI.toast("Couldn't load more", true);
    }
  });

  var searchTimer = null;
  searchInput.addEventListener("input", function () {
    if (searchTimer !== null) window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(function () {
      state.q = searchInput.value.trim();
      refresh();
    }, 300);
  });

  function collectTags() {
    var tags = [];
    state.files.forEach(function (file) {
      (file.tags || []).forEach(function (tag) {
        if (tags.indexOf(tag) === -1) tags.push(tag);
      });
    });
    return tags.sort();
  }

  function renderTagChips() {
    tagChips.textContent = "";
    collectTags().forEach(function (tag) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip" + (state.tag === tag ? " is-active" : "");
      chip.textContent = "#" + tag;
      chip.addEventListener("click", function () {
        state.tag = state.tag === tag ? null : tag;
        refresh();
      });
      tagChips.appendChild(chip);
    });
  }

  function render() {
    renderTagChips();
    fileList.textContent = "";
    loadMoreBtn.hidden = state.cursor === null;

    if (state.files.length === 0) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = state.q || state.tag ? "No matches." : "The vault is empty — upload something.";
      fileList.appendChild(empty);
      return;
    }
    state.files.forEach(function (file) { fileList.appendChild(renderRow(file)); });
  }

  function renderRow(file) {
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
    var info = document.createElement("span");
    info.textContent = window.UI.formatBytes(file.size) + " · " + window.UI.formatDate(file.createdAt);
    sub.appendChild(info);
    if ((file.tags || []).length > 0) {
      var tagsSpan = document.createElement("span");
      tagsSpan.className = "file-row__tags";
      tagsSpan.textContent = file.tags.map(function (t) { return "#" + t; }).join(" ");
      sub.appendChild(tagsSpan);
    }
    meta.appendChild(name);
    meta.appendChild(sub);

    var actions = document.createElement("div");
    actions.className = "file-row__actions";
    actions.appendChild(actionBtn("👁", "Preview " + file.name, function () { preview(file); }));
    actions.appendChild(actionLink("⬇", "Download " + file.name,
      "/api/files/" + file.id + "/content?disposition=attachment"));
    actions.appendChild(actionBtn("🔗", "Share " + file.name, function () { openShare(file); }));
    actions.appendChild(actionBtn("✏️", "Edit " + file.name, function () { openRename(file); }));
    actions.appendChild(actionBtn("🗑", "Delete " + file.name, function () { removeFile(file); }));

    row.appendChild(icon);
    row.appendChild(meta);
    row.appendChild(actions);
    return row;
  }

  function actionBtn(glyph, label, onClick) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "icon-btn";
    btn.setAttribute("aria-label", label);
    btn.textContent = glyph;
    btn.addEventListener("click", onClick);
    return btn;
  }

  function actionLink(glyph, label, href) {
    var a = document.createElement("a");
    a.className = "icon-btn";
    a.setAttribute("aria-label", label);
    a.href = href;
    a.textContent = glyph;
    return a;
  }

  /* ---------- Preview ---------- */

  var previewModal = document.getElementById("preview-modal");
  var previewBody = document.getElementById("preview-body");
  var previewTitle = document.getElementById("preview-title");
  document.getElementById("preview-close").addEventListener("click", function () {
    previewModal.close();
  });
  previewModal.addEventListener("close", function () { previewBody.textContent = ""; });

  function preview(file) {
    previewTitle.textContent = file.name;
    previewBody.textContent = "";
    var url = "/api/files/" + file.id + "/content";
    if (file.mime.indexOf("image/") === 0 && INLINE_PREVIEW.indexOf(file.mime) !== -1) {
      var img = document.createElement("img");
      img.src = url;
      img.alt = file.name;
      previewBody.appendChild(img);
    } else if (INLINE_PREVIEW.indexOf(file.mime) !== -1) {
      var frame = document.createElement("iframe");
      frame.src = url;
      frame.title = file.name;
      previewBody.appendChild(frame);
    } else {
      var p = document.createElement("p");
      p.className = "empty";
      p.textContent = "No inline preview for this type — use download.";
      previewBody.appendChild(p);
    }
    previewModal.showModal();
  }

  /* ---------- Rename / tags ---------- */

  var renameModal = document.getElementById("rename-modal");
  var renameTarget = null;

  function openRename(file) {
    renameTarget = file;
    document.getElementById("rename-name").value = file.name;
    document.getElementById("rename-tags").value = (file.tags || []).join(", ");
    renameModal.showModal();
  }

  renameModal.addEventListener("close", async function () {
    if (renameModal.returnValue !== "save" || renameTarget === null) return;
    var tags = document.getElementById("rename-tags").value
      .split(",")
      .map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length > 0; });
    try {
      await window.API.patch("/api/files/" + renameTarget.id, {
        name: document.getElementById("rename-name").value,
        tags: tags,
      });
      refresh();
    } catch (err) {
      window.UI.toast(err.message || "Couldn't save changes", true);
    }
    renameTarget = null;
  });

  /* ---------- Delete ---------- */

  async function removeFile(file) {
    if (!window.confirm('Delete "' + file.name + '"? Active share links will stop working.')) return;
    try {
      await window.API.del("/api/files/" + file.id);
      window.UI.toast("Deleted");
      refresh();
    } catch (err) {
      window.UI.toast(err.message || "Couldn't delete", true);
    }
  }

  /* ---------- Share + QR ---------- */

  var shareModal = document.getElementById("share-modal");
  var shareForm = document.getElementById("share-form");
  var shareResult = document.getElementById("share-result");
  var shareTarget = null;
  var lastShareUrl = "";

  function openShare(file) {
    shareTarget = file;
    document.getElementById("share-file-name").textContent = file.name;
    shareForm.hidden = false;
    shareResult.hidden = true;
    shareModal.showModal();
  }

  shareForm.addEventListener("submit", async function (event) {
    if (event.submitter && event.submitter.value === "cancel") return; // dialog closes itself
    event.preventDefault();
    if (shareTarget === null) return;
    var maxRaw = document.getElementById("share-max").value;
    try {
      var data = await window.API.post("/api/shares", {
        fileId: shareTarget.id,
        expiry: document.getElementById("share-expiry").value,
        maxDownloads: maxRaw === "" ? null : Number(maxRaw),
      });
      lastShareUrl = data.url;
      document.getElementById("share-url").textContent = data.url;
      renderQr(data.url);
      shareForm.hidden = true;
      shareResult.hidden = false;
    } catch (err) {
      window.UI.toast(err.message || "Couldn't create share", true);
    }
  });

  function renderQr(url) {
    var holder = document.getElementById("share-qr");
    holder.textContent = "";
    try {
      var qr = window.qrcode(0, "M");
      qr.addData(url);
      qr.make();
      holder.innerHTML = qr.createSvgTag({ scalable: true, margin: 2 });
    } catch (err) {
      /* QR is a nicety; the link still shows */
    }
  }

  document.getElementById("share-copy").addEventListener("click", function () {
    window.UI.copyText(lastShareUrl);
  });
  document.getElementById("share-done").addEventListener("click", function () {
    shareModal.close();
  });

  /* ---------- Boot ---------- */
  refresh();
})();
