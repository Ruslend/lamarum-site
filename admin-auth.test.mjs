import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { handleAdminLogin, handleAdminLogout, requireAdminAuth, showAdminLogin } from "./admin-auth.mjs";

test("uses an admin login form and signed session cookie", async () => {
  const previousPassword = process.env.ADMIN_PASSWORD;
  const previousUsername = process.env.ADMIN_USERNAME;
  process.env.ADMIN_PASSWORD = "test-password";
  process.env.ADMIN_USERNAME = "admin";

  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.get("/admin/login", showAdminLogin);
  app.post("/admin/login", handleAdminLogin);
  app.post("/admin/logout", handleAdminLogout);
  app.get("/admin", requireAdminAuth, (_request, response) => response.send("OK"));
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/admin`, { redirect: "manual" });

    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/admin/login");

    const loginPageResponse = await fetch(`http://127.0.0.1:${port}/admin/login`);
    assert.equal(loginPageResponse.status, 200);
    assert.match(await loginPageResponse.text(), /Вход в админку/);

    const failedLoginResponse = await fetch(`http://127.0.0.1:${port}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: "admin", password: "wrong-password" }),
    });

    assert.equal(failedLoginResponse.status, 401);
    assert.match(await failedLoginResponse.text(), /Неверный логин или пароль/);

    const loginResponse = await fetch(`http://127.0.0.1:${port}/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: "admin", password: "test-password" }),
      redirect: "manual",
    });

    assert.equal(loginResponse.status, 303);
    assert.equal(loginResponse.headers.get("location"), "/admin/schedule");

    const sessionCookie = loginResponse.headers.get("set-cookie");
    assert.match(sessionCookie, /lamarum_admin_session=/);

    const sessionResponse = await fetch(`http://127.0.0.1:${port}/admin`, {
      headers: { Cookie: sessionCookie },
    });

    assert.equal(sessionResponse.status, 200);
    assert.equal(await sessionResponse.text(), "OK");

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

    if (previousUsername === undefined) {
      delete process.env.ADMIN_USERNAME;
    } else {
      process.env.ADMIN_USERNAME = previousUsername;
    }
  }
});
