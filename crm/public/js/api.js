/* Shared fetch wrapper: JSON in/out, uniform errors, 401 → login. */
(function () {
  "use strict";

  function redirectToLogin() {
    // Workers assets serve /login.html at /login — treat both (and /setup)
    // as auth pages so a 401 there never triggers a redirect loop.
    if (!/\/(login|setup)(\.html)?$/.test(window.location.pathname)) {
      window.location.href = "/login.html";
    }
  }

  async function request(method, path, body, extraHeaders) {
    var headers = Object.assign({}, extraHeaders || {});
    var init = { method: method, headers: headers, credentials: "same-origin" };
    if (body !== undefined && body !== null) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }
    var res;
    try {
      res = await fetch(path, init);
    } catch (err) {
      throw { code: "network", message: "Network error — are you offline?" };
    }
    if (res.status === 401) {
      redirectToLogin();
      throw { code: "unauthorized", message: "Signed out." };
    }
    var payload = null;
    try {
      payload = await res.json();
    } catch (err) {
      throw { code: "bad_response", message: "Unexpected server response." };
    }
    if (!res.ok || payload.ok === false) {
      var error = (payload && payload.error) || {};
      throw {
        code: error.code || "error",
        message: error.message || "Something went wrong.",
        status: res.status,
        data: payload ? payload.data : null,
      };
    }
    return payload.data;
  }

  window.API = {
    get: function (path) { return request("GET", path); },
    post: function (path, body) { return request("POST", path, body); },
    put: function (path, body) { return request("PUT", path, body); },
    patch: function (path, body) { return request("PATCH", path, body); },
    del: function (path) { return request("DELETE", path); },

    /* Raw upload: body is a File/Blob, filename via header. */
    upload: async function (file, onDone) {
      var res;
      try {
        res = await fetch("/api/files", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "X-File-Name": file.name || "upload",
            "Content-Type": file.type || "application/octet-stream",
          },
          body: file,
        });
      } catch (err) {
        throw { code: "network", message: "Upload failed — network error." };
      }
      if (res.status === 401) { redirectToLogin(); throw { code: "unauthorized" }; }
      var payload = await res.json().catch(function () { return null; });
      if (!res.ok || !payload || payload.ok === false) {
        var error = (payload && payload.error) || {};
        throw { code: error.code || "upload_failed", message: error.message || "Upload failed." };
      }
      if (onDone) onDone(payload.data);
      return payload.data;
    },
  };
})();
