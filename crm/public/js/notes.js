/* Notes: list + editor with explicit save. */
(function () {
  "use strict";

  var listEl = document.getElementById("notes-list");
  var editorCard = document.getElementById("editor-card");
  var noNote = document.getElementById("no-note");
  var titleInput = document.getElementById("note-title");
  var bodyInput = document.getElementById("note-body");
  var statusEl = document.getElementById("note-status");

  var notes = [];
  var activeId = null;

  function setStatus(message) { statusEl.textContent = message || ""; }

  function renderList() {
    listEl.textContent = "";
    if (notes.length === 0) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No notes yet.";
      listEl.appendChild(empty);
      return;
    }
    notes.forEach(function (note) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "note-item" + (note.id === activeId ? " is-active" : "");
      var title = document.createElement("div");
      title.className = "note-item__title";
      title.textContent = note.title || "Untitled";
      var date = document.createElement("div");
      date.className = "note-item__date";
      date.textContent = window.UI.formatDate(note.updatedAt);
      item.appendChild(title);
      item.appendChild(date);
      item.addEventListener("click", function () { open(note.id); });
      listEl.appendChild(item);
    });
  }

  function open(id) {
    var note = notes.find(function (n) { return n.id === id; });
    if (!note) return;
    activeId = id;
    titleInput.value = note.title;
    bodyInput.value = note.body;
    editorCard.hidden = false;
    noNote.hidden = true;
    setStatus("");
    renderList();
  }

  async function load() {
    try {
      notes = await window.API.get("/api/notes");
      renderList();
      if (activeId !== null && !notes.some(function (n) { return n.id === activeId; })) {
        activeId = null;
        editorCard.hidden = true;
        noNote.hidden = false;
      }
    } catch (err) {
      if (err.code !== "unauthorized") window.UI.toast("Couldn't load notes", true);
    }
  }

  document.getElementById("new-note").addEventListener("click", async function () {
    try {
      var note = await window.API.post("/api/notes", { title: "", body: "" });
      await load();
      open(note.id);
      titleInput.focus();
    } catch (err) {
      window.UI.toast(err.message || "Couldn't create note", true);
    }
  });

  document.getElementById("save-note").addEventListener("click", async function () {
    if (activeId === null) return;
    setStatus("Saving…");
    try {
      await window.API.put("/api/notes/" + activeId, {
        title: titleInput.value || "Untitled",
        body: bodyInput.value,
      });
      setStatus("Saved");
      load();
    } catch (err) {
      setStatus("");
      window.UI.toast(err.message || "Couldn't save", true);
    }
  });

  document.getElementById("delete-note").addEventListener("click", async function () {
    if (activeId === null) return;
    if (!window.confirm("Delete this note?")) return;
    try {
      await window.API.del("/api/notes/" + activeId);
      activeId = null;
      editorCard.hidden = true;
      noNote.hidden = false;
      load();
    } catch (err) {
      window.UI.toast(err.message || "Couldn't delete", true);
    }
  });

  load();
})();
