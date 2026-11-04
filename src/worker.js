/**
 * bee747.com — one Cloudflare Worker that serves the static site AND a
 * single tiny API endpoint for the live hive panel.
 *
 *   GET  /api/apiary   public. Returns the latest JSON snapshot the Pi sent.
 *   PUT  /api/apiary   the Pi only. Bearer token in the Authorization header.
 *   anything else      served from ./public by Workers static assets.
 *
 * Storage is one Workers KV key ("apiary"). KV is eventually consistent, which
 * is fine for a reading that changes every ten minutes; the page polls every
 * minute and the browser caches each answer for 30 s.
 *
 * The JSON shape is INTERFACE_CONTRACTS.md Link 6. The Worker checks only the
 * outline (updated + hives present, under 16 KB) — the Pi owns the content.
 */

const KEY = "apiary";
const MAX_BYTES = 16 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // www → apex, so there is exactly one URL for everything.
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }

    if (url.pathname === "/api/apiary") return apiary(request, env);
    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);

    return env.ASSETS.fetch(request);
  },
};

async function apiary(request, env) {
  if (request.method === "GET" || request.method === "HEAD") {
    const { value, metadata } = await env.LIVE.getWithMetadata(KEY, { type: "text" });
    if (value == null) {
      return json({ error: "no data published yet" }, 503, { "Cache-Control": "no-store" });
    }
    return new Response(request.method === "HEAD" ? null : value, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=30",
        "X-Received-At": (metadata && metadata.receivedAt) || "",
      },
    });
  }

  if (request.method === "PUT") {
    if (!(await authorized(request.headers.get("Authorization"), env.PUBLISH_TOKEN))) {
      return json({ error: "unauthorized" }, 401);
    }
    const declared = Number(request.headers.get("Content-Length") || 0);
    if (declared > MAX_BYTES) return json({ error: "too large" }, 413);
    const text = await request.text();
    if (text.length > MAX_BYTES) return json({ error: "too large" }, 413);

    let body;
    try { body = JSON.parse(text); } catch { return json({ error: "body is not JSON" }, 400); }
    if (!body || typeof body !== "object" || typeof body.updated !== "string" ||
        !body.hives || typeof body.hives !== "object") {
      return json({ error: "expected {updated, hives, weather?}" }, 400);
    }

    await env.LIVE.put(KEY, JSON.stringify(body), {
      metadata: { receivedAt: new Date().toISOString() },
    });
    return new Response(null, { status: 204 });
  }

  return json({ error: "method not allowed" }, 405, { Allow: "GET, HEAD, PUT" });
}

/** Bearer-token check in constant time, so a wrong token can't be timed. */
async function authorized(header, token) {
  if (!token || !header || !header.startsWith("Bearer ")) return false;
  const enc = new TextEncoder();
  const a = enc.encode(header.slice(7));
  const b = enc.encode(token);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...extra },
  });
}
