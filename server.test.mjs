import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { app } from "./server.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));

test("serves the production frontend and keeps API behavior isolated", async () => {
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const origin = `http://127.0.0.1:${port}`;
    const indexHtml = await readFile(join(root, "dist", "index.html"), "utf8");
    const jsPath = indexHtml.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    const cssPath = indexHtml.match(/href="(\/assets\/[^"]+\.css)"/)?.[1];

    assert.ok(jsPath, "dist/index.html must reference a JavaScript asset");
    assert.ok(cssPath, "dist/index.html must reference a CSS asset");

    const rootResponse = await fetch(`${origin}/`);
    assert.equal(rootResponse.status, 200);
    assert.match(rootResponse.headers.get("content-type"), /^text\/html/);
    assert.equal(await rootResponse.text(), indexHtml);

    const csp = rootResponse.headers.get("content-security-policy");
    assert.match(csp, /script-src-elem 'self'/);
    assert.match(csp, /style-src-elem 'self' 'unsafe-inline'/);
    assert.doesNotMatch(csp, /upgrade-insecure-requests/);

    const jsResponse = await fetch(`${origin}${jsPath}`, {
      method: "HEAD",
      headers: { Origin: "http://example.test" },
    });
    assert.equal(jsResponse.status, 200);
    assert.match(jsResponse.headers.get("content-type"), /^(application|text)\/javascript/);
    assert.equal(jsResponse.headers.get("access-control-allow-origin"), null);

    const cssResponse = await fetch(`${origin}${cssPath}`, { method: "HEAD" });
    assert.equal(cssResponse.status, 200);
    assert.match(cssResponse.headers.get("content-type"), /^text\/css/);

    const missingAssetResponse = await fetch(`${origin}/assets/missing.js`);
    assert.equal(missingAssetResponse.status, 404);
    assert.match(missingAssetResponse.headers.get("content-type"), /^text\/plain/);

    const healthResponse = await fetch(`${origin}/health`);
    assert.equal(healthResponse.status, 200);
    assert.equal(await healthResponse.text(), "OK");

    const getLeadResponse = await fetch(`${origin}/api/lead`);
    assert.equal(getLeadResponse.status, 405);
    assert.equal(getLeadResponse.headers.get("allow"), "POST");

    const postLeadResponse = await fetch(`${origin}/api/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(postLeadResponse.status, 400);

    const robotsResponse = await fetch(`${origin}/robots.txt`);
    assert.equal(robotsResponse.status, 200);
    assert.match(robotsResponse.headers.get("content-type"), /^text\/plain/);

    const sitemapResponse = await fetch(`${origin}/sitemap.xml`);
    assert.equal(sitemapResponse.status, 200);
    assert.match(sitemapResponse.headers.get("content-type"), /^(application|text)\/xml/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
