/* Shares page: active share links with revoke; passkey management. */
(function () {
  "use strict";

  var sharesList = document.getElementById("shares-list");
  var passkeysList = document.getElementById("passkeys-list");
  var deviceStatus = document.getElementById("device-status");

  /* ---------- Shares ---------- */

  async function loadShares() {
    try {
      renderShares(await window.API.get("/api/shares"));
    } catch (err) {
      if (err.code !== "unauthorized") window.UI.toast("Couldn't load shares", true);
    }
  }

  function renderShares(shares) {
    sharesList.textContent = "";
    if (shares.length === 0) {
      var empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No active links. Share a file from the vault.";
      sharesList.appendChild(empty);
      return;
    }
    shares.forEach(function (share) {
      var row = document.createElement("div");
      row.className = "share-row";

      var meta = document.createElement("div");
      meta.className = "share-row__meta";
      var name = document.createElement("div");
      name.className = "share-row__name";
      name.textContent = share.fileName;
      var sub = document.createElement("div");
      sub.className = "share-row__sub";
      var downloads = share.maxDownloads === null
        ? share.downloadCount + " downloads"
        : share.downloadCount + "/" + share.maxDownloads + " downloads";
      sub.textContent = window.UI.formatCountdown(share.expiresAt) + " · " + downloads;
      meta.appendChild(name);
      meta.appendChild(sub);

      var revoke = document.createElement("button");
      revoke.type = "button";
      revoke.className = "btn btn--danger btn--sm";
      revoke.textContent = "Revoke";
      revoke.addEventListener("click", async function () {
        try {
          await window.API.del("/api/shares/" + share.id);
          window.UI.toast("Link revoked");
          loadShares();
        } catch (err) {
          window.UI.toast(err.message || "Couldn't revoke", true);
        }
      });

      row.appendChild(meta);
      row.appendChild(revoke);
      sharesList.appendChild(row);
    });
  }

  /* ---------- Passkeys ---------- */

  function setDeviceStatus(message) { deviceStatus.textContent = message || ""; }

  async function loadPasskeys() {
    try {
      renderPasskeys(await window.API.get("/api/passkeys"));
    } catch (err) {
      if (err.code !== "unauthorized") window.UI.toast("Couldn't load passkeys", true);
    }
  }

  function renderPasskeys(passkeys) {
    passkeysList.textContent = "";
    passkeys.forEach(function (passkey) {
      var row = document.createElement("div");
      row.className = "share-row";

      var meta = document.createElement("div");
      meta.className = "share-row__meta";
      var name = document.createElement("div");
      name.className = "share-row__name";
      name.textContent = "🔑 " + passkey.label;
      var sub = document.createElement("div");
      sub.className = "share-row__sub";
      sub.textContent = "Added " + window.UI.formatDate(passkey.createdAt) +
        (passkey.lastUsedAt ? " · last used " + window.UI.formatDate(passkey.lastUsedAt) : "");
      meta.appendChild(name);
      meta.appendChild(sub);

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "btn btn--danger btn--sm";
      remove.textContent = "Remove";
      remove.disabled = passkeys.length <= 1;
      remove.title = passkeys.length <= 1 ? "You can't remove your only passkey" : "";
      remove.addEventListener("click", async function () {
        if (!window.confirm('Remove passkey "' + passkey.label + '"?')) return;
        try {
          await window.API.del("/api/passkeys/" + encodeURIComponent(passkey.id));
          loadPasskeys();
        } catch (err) {
          window.UI.toast(err.message || "Couldn't remove passkey", true);
        }
      });

      row.appendChild(meta);
      row.appendChild(remove);
      passkeysList.appendChild(row);
    });
  }

  document.getElementById("add-device").addEventListener("click", async function () {
    if (!window.WebAuthnClient.supported()) {
      setDeviceStatus("This browser doesn't support passkeys.");
      return;
    }
    var label = window.prompt("Name this device (e.g. iPhone):", "New device");
    if (label === null) return;
    setDeviceStatus("Follow the passkey prompt…");
    try {
      var data = await window.API.post("/api/passkeys/options");
      var attestation = await window.WebAuthnClient.register(data.options);
      await window.API.post("/api/passkeys/verify", {
        challengeId: data.challengeId,
        label: label || "New device",
        response: attestation,
      });
      setDeviceStatus("");
      window.UI.toast("Passkey added");
      loadPasskeys();
    } catch (err) {
      setDeviceStatus(err && err.message ? err.message : "Couldn't add passkey.");
    }
  });

  loadShares();
  loadPasskeys();
  window.setInterval(loadShares, 30000); // keep countdowns honest
})();
