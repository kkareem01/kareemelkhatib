/** Response helpers + security headers. All API responses flow through
 * these so headers and error shapes stay uniform. */

const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  "Content-Security-Policy":
    "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; " +
    "img-src 'self' blob: data:; connect-src 'self'; frame-src 'self'; " +
    "manifest-src 'self'; object-src 'none'; base-uri 'none'; " +
    "form-action 'self'; frame-ancestors 'none'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
};

export function withSecurityHeaders(headers?: HeadersInit): Headers {
  const h = new Headers(headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    if (!h.has(key)) h.set(key, value);
  }
  return h;
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  const h = withSecurityHeaders(headers);
  h.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { status, headers: h });
}

/** Generic error envelope — code is machine-readable, message is safe to
 * show; never includes internals. */
export function apiError(code: string, message: string, status: number): Response {
  return json({ ok: false, error: { code, message } }, status);
}

export function badRequest(message: string): Response {
  return apiError("bad_request", message, 400);
}

export function unauthorized(): Response {
  return apiError("unauthorized", "Authentication required.", 401);
}

export function notFound(): Response {
  return apiError("not_found", "Not found.", 404);
}

export function tooManyRequests(): Response {
  return apiError("rate_limited", "Too many attempts. Try again later.", 429);
}

export function serverError(): Response {
  return apiError("server_error", "Something went wrong.", 500);
}

/** Minimal HTML 404 for public share redemption — identical for
 * invalid/expired/revoked so the endpoint is not an oracle. */
export function shareNotFoundPage(): Response {
  const h = withSecurityHeaders();
  h.set("Content-Type", "text/html; charset=utf-8");
  const body =
    "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>Link unavailable</title>" +
    "<style>body{font-family:Georgia,serif;background:#faf8f4;color:#211b16;" +
    "display:grid;place-items:center;min-height:100vh;margin:0}" +
    "main{text-align:center;padding:2rem}h1{font-weight:500}" +
    "p{color:#5c5247}</style></head><body><main>" +
    "<h1>This link isn&rsquo;t available</h1>" +
    "<p>It may have expired or been removed.</p>" +
    "</main></body></html>";
  return new Response(body, { status: 404, headers: h });
}

/** Cheap CSRF defense-in-depth on top of SameSite=Strict cookies: reject
 * cross-site state-changing requests. Sec-Fetch-Site is absent in some
 * non-browser clients (curl) — those are allowed; the session cookie is
 * still required. */
export function isCrossSite(req: Request): boolean {
  const site = req.headers.get("Sec-Fetch-Site");
  return site !== null && site !== "same-origin" && site !== "none";
}

export function clientIp(req: Request): string {
  return req.headers.get("CF-Connecting-IP") ?? "unknown";
}
