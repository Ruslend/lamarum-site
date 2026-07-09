import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { app, buildScheduleAdminPage } from "./server.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));

test("admin schedule page is server-rendered without client api references", () => {
  const html = buildScheduleAdminPage({
    slots: [
      {
        id: "1",
        weekday: "Понедельник",
        date: "2026-07-13",
        time: "18:00",
        status: "available",
      },
      {
        id: "2",
        weekday: "Вторник",
        date: "2026-07-14",
        time: "19:00",
        status: "booked",
      },
    ],
    trialBookings: [
      {
        id: "7",
        created_at: new Date("2026-07-09T12:00:00+03:00"),
        parent_name: "Анна",
        student_name: "Илья",
        grade: "9 класс",
        contact: "@parent",
        slot_label: "Понедельник, 13 июля, 18:00",
        goal: "Подготовка к ОГЭ",
        comment: "Нужна диагностика",
        status: "new",
      },
    ],
    applications: [],
  });

  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /\bapi\s*[.(]/i);
  assert.match(html, /Добавить слот/);
  assert.match(html, /Сделать занятым/);
  assert.match(html, /Освободить/);
  assert.match(html, /Удалить/);
  assert.match(html, /Записи на пробный урок/);
});

test("serves the production frontend and keeps API behavior isolated", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousPassword = process.env.ADMIN_PASSWORD;
  delete process.env.DATABASE_URL;
  process.env.ADMIN_PASSWORD = "test-password";

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

    const scheduleResponse = await fetch(`${origin}/api/schedule`);
    assert.equal(scheduleResponse.status, 503);
    assert.deepEqual(await scheduleResponse.json(), {
      ok: false,
      message: "Расписание временно недоступно. Можно записаться через Telegram",
    });

    const adminResponse = await fetch(`${origin}/admin`, {
      headers: {
        Authorization: `Basic ${Buffer.from("admin:test-password").toString("base64")}`,
      },
    });
    assert.equal(adminResponse.status, 503);
    assert.equal(await adminResponse.text(), "База данных не настроена");

    const getLeadResponse = await fetch(`${origin}/api/lead`);
    assert.equal(getLeadResponse.status, 405);
    assert.equal(getLeadResponse.headers.get("allow"), "POST");

    const getBookingsResponse = await fetch(`${origin}/api/bookings`);
    assert.equal(getBookingsResponse.status, 405);
    assert.equal(getBookingsResponse.headers.get("allow"), "POST");

    const postScheduleResponse = await fetch(`${origin}/api/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(postScheduleResponse.status, 405);
    assert.equal(postScheduleResponse.headers.get("allow"), "GET");

    const postLeadResponse = await fetch(`${origin}/api/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(postLeadResponse.status, 503);

    const postBookingResponse = await fetch(`${origin}/api/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(postBookingResponse.status, 503);

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

    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }

    if (previousPassword === undefined) {
      delete process.env.ADMIN_PASSWORD;
    } else {
      process.env.ADMIN_PASSWORD = previousPassword;
    }
  }
});
