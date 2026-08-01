/* WebAuthn browser ceremonies: base64url codecs + create/get wrappers.
   Server speaks @simplewebauthn JSON; this converts to/from ArrayBuffers. */
(function () {
  "use strict";

  function b64uToBuf(input) {
    var b64 = input.replace(/-/g, "+").replace(/_/g, "/");
    var padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    var bin = atob(padded);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }

  function bufToB64u(buffer) {
    var bytes = new Uint8Array(buffer);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function supported() {
    return typeof window.PublicKeyCredential !== "undefined";
  }

  /* options: PublicKeyCredentialCreationOptionsJSON from the server. */
  async function register(options) {
    var publicKey = Object.assign({}, options, {
      challenge: b64uToBuf(options.challenge),
      user: Object.assign({}, options.user, { id: b64uToBuf(options.user.id) }),
      excludeCredentials: (options.excludeCredentials || []).map(function (c) {
        return Object.assign({}, c, { id: b64uToBuf(c.id) });
      }),
    });
    var credential = await navigator.credentials.create({ publicKey: publicKey });
    if (!credential) throw new Error("Passkey creation was cancelled.");
    var response = credential.response;
    return {
      id: credential.id,
      rawId: bufToB64u(credential.rawId),
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults() || {},
      authenticatorAttachment: credential.authenticatorAttachment || undefined,
      response: {
        attestationObject: bufToB64u(response.attestationObject),
        clientDataJSON: bufToB64u(response.clientDataJSON),
        transports:
          typeof response.getTransports === "function"
            ? response.getTransports()
            : undefined,
      },
    };
  }

  /* options: PublicKeyCredentialRequestOptionsJSON from the server. */
  async function authenticate(options) {
    var publicKey = Object.assign({}, options, {
      challenge: b64uToBuf(options.challenge),
      allowCredentials: (options.allowCredentials || []).map(function (c) {
        return Object.assign({}, c, { id: b64uToBuf(c.id) });
      }),
    });
    var credential = await navigator.credentials.get({ publicKey: publicKey });
    if (!credential) throw new Error("Sign-in was cancelled.");
    var response = credential.response;
    return {
      id: credential.id,
      rawId: bufToB64u(credential.rawId),
      type: credential.type,
      clientExtensionResults: credential.getClientExtensionResults() || {},
      authenticatorAttachment: credential.authenticatorAttachment || undefined,
      response: {
        authenticatorData: bufToB64u(response.authenticatorData),
        clientDataJSON: bufToB64u(response.clientDataJSON),
        signature: bufToB64u(response.signature),
        userHandle: response.userHandle ? bufToB64u(response.userHandle) : undefined,
      },
    };
  }

  window.WebAuthnClient = {
    supported: supported,
    register: register,
    authenticate: authenticate,
  };
})();
