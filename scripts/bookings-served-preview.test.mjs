import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { once } from "node:events";

// Isolated, read-only smoke test: no external services, real traveler data or payments.
const assets = new Map([
  ["/bookings.html", ["docs/bookings.html", "text/html; charset=utf-8"]],
  ["/bookings.mjs", ["docs/bookings.mjs", "text/javascript; charset=utf-8"]],
  ["/bookings-model.mjs", ["docs/bookings-model.mjs", "text/javascript; charset=utf-8"]],
]);

test("booking preview serves bilingual HTML and local modules over HTTP", async () => {
  const server = createServer(async (req, res) => {
    const asset = assets.get(req.url ?? "");
    if (!asset) { res.writeHead(404); res.end("Not found"); return; }
    try {
      const bytes = await readFile(resolve(asset[0]));
      res.writeHead(200, { "Content-Type": asset[1], "Cache-Control": "no-store" });
      res.end(bytes);
    } catch { res.writeHead(500); res.end("Missing preview asset"); }
  });
  server.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    const htmlResponse = await fetch(base + "/bookings.html");
    assert.equal(htmlResponse.status, 200);
    assert.match(htmlResponse.headers.get("content-type") ?? "", /text\/html/);
    const html = await htmlResponse.text();
    assert.match(html, /lang="ar" dir="rtl"/);
    assert.match(html, /data-en=/);
    assert.match(html, /لا تُدخل أسماء مسافرين/);
    // Preview must remain a local-only reference register, not a live booking/payment form.
    assert.match(html, /<form\b[^>]*id="booking-form"[^>]*>/i);
    assert.doesNotMatch(html, /<form\b[^>]*\baction\s*=/i);
    assert.doesNotMatch(html, /<form\b[^>]*\bmethod\s*=\s*["']?post/i);
    assert.deepEqual(
      [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)].map(match => match[1]),
      ["bookings.mjs"],
      "Only the local booking module may execute"
    );
    assert.doesNotMatch(html, /<base\b|<meta\b[^>]*http-equiv\s*=\s*["']?refresh/i);
    assert.doesNotMatch(html, /<iframe\b|<link\b[^>]*rel\s*=\s*["']?preload/i);
    assert.match(html, /no pricing, payments or ticket issuance/i);
    for (const name of ["bookings.mjs", "bookings-model.mjs"]) {
      const response = await fetch(base + "/" + name);
      assert.equal(response.status, 200, name);
      assert.match(response.headers.get("content-type") ?? "", /javascript/);
      assert.ok((await response.text()).length > 100, name);
    }
    assert.equal((await fetch(base + "/private")).status, 404);
  } finally {
    await new Promise((done, reject) => server.close(error => error ? reject(error) : done()));
  }
});
