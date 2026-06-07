import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { requireAdminAuth } from "./admin-auth.mjs";

test("returns an ASCII Basic Auth challenge for /admin", async () => {
  const previousPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = "test-password";

  const app = express();
  app.get("/admin", requireAdminAuth, (_request, response) => response.send("OK"));
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/admin`);

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("www-authenticate"), 'Basic realm="Admin Area"');
    assert.match(await response.text(), /Требуется авторизация/);

    const authorizedResponse = await fetch(`http://127.0.0.1:${port}/admin`, {
      headers: {
        Authorization: `Basic ${Buffer.from("admin:test-password").toString("base64")}`,
      },
    });

    assert.equal(authorizedResponse.status, 200);
    assert.equal(await authorizedResponse.text(), "OK");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });

    if (previousPassword === undefined) {
      delete process.env.ADMIN_PASSWORD;
    } else {
      process.env.ADMIN_PASSWORD = previousPassword;
    }
  }
});
