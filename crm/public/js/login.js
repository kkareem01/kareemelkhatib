/* Login page: passkey ceremony + passphrase fallback. */
(function () {
  "use strict";

  var statusEl = document.getElementById("login-status");
  var passkeyBtn = document.getElementById("passkey-btn");
  var showPassphraseBtn = document.getElementById("show-passphrase");
  var passphraseForm = document.getElementById("passphrase-form");

  function setStatus(message) {
    statusEl.textContent = message || "";
  }

  function goHome() {
    window.location.href = "/";
  }

  async function passkeyLogin() {
    if (!window.WebAuthnClient.supported()) {
      setStatus("This browser doesn't support passkeys — use the backup passphrase.");
      return;
    }
    passkeyBtn.disabled = true;
    setStatus("Waiting for your passkey…");
    try {
      var data = await window.API.post("/api/auth/login/options");
      var assertion = await window.WebAuthnClient.authenticate(data.options);
      await window.API.post("/api/auth/login/verify", {
        challengeId: data.challengeId,
        response: assertion,
      });
      setStatus("Welcome back.");
      goHome();
    } catch (err) {
      setStatus(err && err.message ? err.message : "Sign-in failed — try again.");
      passkeyBtn.disabled = false;
    }
  }

  passkeyBtn.addEventListener("click", passkeyLogin);

  showPassphraseBtn.addEventListener("click", function () {
    passphraseForm.hidden = !passphraseForm.hidden;
    if (!passphraseForm.hidden) {
      document.getElementById("passphrase").focus();
    }
  });

  passphraseForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var input = document.getElementById("passphrase");
    setStatus("Checking…");
    try {
      await window.API.post("/api/auth/passphrase", { passphrase: input.value });
      goHome();
    } catch (err) {
      setStatus(err && err.message ? err.message : "Sign-in failed.");
      input.value = "";
      input.focus();
    }
  });

  /* Already signed in? Skip the page. */
  window.API.get("/api/auth/me").then(goHome).catch(function () {});
})();
