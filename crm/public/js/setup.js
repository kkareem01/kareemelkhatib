/* One-time bootstrap: setup token → first passkey → backup passphrase. */
(function () {
  "use strict";

  var statusEl = document.getElementById("setup-status");
  var tokenStep = document.getElementById("step-token");
  var passphraseStep = document.getElementById("step-passphrase");
  var tokenForm = document.getElementById("token-form");
  var passphraseForm = document.getElementById("passphrase-form");
  var passphraseInput = document.getElementById("new-passphrase");

  var WORDS = ("amber basil cedar delta ember fable gable harbor indigo juniper " +
    "kestrel lantern maple nectar orchid pebble quartz raven saffron timber " +
    "umber violet walnut yonder zephyr anchor breeze canyon dune ember flint " +
    "grove harvest island jasper knoll ledger meadow north opal prairie quill " +
    "ridge summit trellis upland vessel willow yarrow zenith").split(/\s+/);

  function setStatus(message) { statusEl.textContent = message || ""; }

  function suggestPassphrase() {
    var indexes = new Uint32Array(5);
    crypto.getRandomValues(indexes);
    var words = [];
    for (var i = 0; i < 5; i++) words.push(WORDS[indexes[i] % WORDS.length]);
    passphraseInput.value = words.join("-") + "-" + (indexes[0] % 100);
  }

  tokenForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    var token = document.getElementById("setup-token").value.trim();
    var label = document.getElementById("device-label").value.trim() || "First device";
    if (!window.WebAuthnClient.supported()) {
      setStatus("This browser doesn't support passkeys. Use Safari or Chrome.");
      return;
    }
    setStatus("Requesting registration…");
    try {
      var optionsRes = await fetch("/api/setup/options", {
        method: "POST",
        credentials: "same-origin",
        headers: { "X-Setup-Token": token },
      });
      var optionsBody = await optionsRes.json();
      if (!optionsRes.ok || optionsBody.ok === false) {
        throw new Error((optionsBody.error && optionsBody.error.message) || "Setup rejected.");
      }
      setStatus("Follow your browser's passkey prompt…");
      var attestation = await window.WebAuthnClient.register(optionsBody.data.options);

      var verifyRes = await fetch("/api/setup/verify", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "X-Setup-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challengeId: optionsBody.data.challengeId,
          label: label,
          response: attestation,
        }),
      });
      var verifyBody = await verifyRes.json();
      if (!verifyRes.ok || verifyBody.ok === false) {
        throw new Error((verifyBody.error && verifyBody.error.message) || "Verification failed.");
      }

      setStatus("");
      tokenStep.hidden = true;
      passphraseStep.hidden = false;
      suggestPassphrase();
    } catch (err) {
      setStatus(err && err.message ? err.message : "Setup failed — try again.");
    }
  });

  document.getElementById("regen").addEventListener("click", suggestPassphrase);

  passphraseForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    setStatus("Saving…");
    try {
      await window.API.put("/api/auth/passphrase-config", {
        passphrase: passphraseInput.value,
      });
      setStatus("All set — remember to delete the SETUP_TOKEN secret.");
      window.setTimeout(function () { window.location.href = "/"; }, 1500);
    } catch (err) {
      setStatus(err && err.message ? err.message : "Couldn't save the passphrase.");
    }
  });
})();
