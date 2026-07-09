import { createHmac, timingSafeEqual } from "node:crypto";

const sessionCookieName = "lamarum_admin_session";
const sessionTtlMs = 12 * 60 * 60 * 1000;

export function requireAdminAuth(request, response, next) {
  if (!getAdminPassword()) {
    response.status(503).type("text").send("Админ-страница не настроена.");
    return;
  }

  if (hasValidAdminSession(request) || hasValidBasicAuth(request)) {
    next();
    return;
  }

  response.redirect(303, "/admin/login");
}

export function showAdminLogin(request, response) {
  if (!getAdminPassword()) {
    response.status(503).type("text").send("Админ-страница не настроена.");
    return;
  }

  if (hasValidAdminSession(request) || hasValidBasicAuth(request)) {
    response.redirect(303, "/admin/schedule");
    return;
  }

  response.set("Cache-Control", "no-store").type("html").send(buildAdminLoginPage());
}

export function handleAdminLogin(request, response) {
  if (!getAdminPassword()) {
    response.status(503).type("text").send("Админ-страница не настроена.");
    return;
  }

  const username = String(request.body?.username || "").trim();
  const password = String(request.body?.password || "");

  if (username !== getAdminUsername() || !safeEqual(password, getAdminPassword())) {
    response.status(401).set("Cache-Control", "no-store").type("html").send(buildAdminLoginPage("Неверный логин или пароль."));
    return;
  }

  response.setHeader("Set-Cookie", buildSessionCookie(username));
  response.redirect(303, "/admin/schedule");
}

export function handleAdminLogout(_request, response) {
  response.setHeader(
    "Set-Cookie",
    `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/admin; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
  response.redirect(303, "/admin/login");
}

function hasValidBasicAuth(request) {
  const authorization = request.get("authorization") || "";
  const [scheme, encodedCredentials] = authorization.split(" ");
  let credentials = "";

  try {
    credentials = Buffer.from(encodedCredentials || "", "base64").toString("utf8");
  } catch {
    credentials = "";
  }

  const separatorIndex = credentials.indexOf(":");
  const username = separatorIndex >= 0 ? credentials.slice(0, separatorIndex) : "";
  const password = separatorIndex >= 0 ? credentials.slice(separatorIndex + 1) : "";

  return scheme === "Basic" && username === getAdminUsername() && safeEqual(password, getAdminPassword());
}

function hasValidAdminSession(request) {
  const cookie = parseCookies(request.get("cookie") || "")[sessionCookieName];

  if (!cookie) {
    return false;
  }

  const [encodedPayload, signature] = cookie.split(".");

  if (!encodedPayload || !signature || !safeEqual(signature, signValue(encodedPayload))) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));

    return payload.username === getAdminUsername() && Number(payload.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

function buildSessionCookie(username) {
  const payload = Buffer.from(
    JSON.stringify({
      username,
      expiresAt: Date.now() + sessionTtlMs,
    }),
  ).toString("base64url");
  const signature = signValue(payload);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  return `${sessionCookieName}=${payload}.${signature}; HttpOnly; SameSite=Lax; Path=/admin; Max-Age=${Math.floor(sessionTtlMs / 1000)}${secure}`;
}

function parseCookies(header) {
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf("=");

      if (separatorIndex < 0) {
        return cookies;
      }

      cookies[part.slice(0, separatorIndex)] = decodeURIComponent(part.slice(separatorIndex + 1));
      return cookies;
    }, {});
}

function signValue(value) {
  return createHmac("sha256", getAdminPassword()).update(value).digest("base64url");
}

function getAdminUsername() {
  const username = String(process.env.ADMIN_USERNAME || "admin").trim();

  return username && username !== "gen_user" ? username : "admin";
}

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual));
  const expectedBuffer = Buffer.from(String(expected));

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function escapeHtml(value) {
  return String(value).replace(/[<>&"']/g, (character) => {
    const replacements = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return replacements[character];
  });
}

function buildAdminLoginPage(error = "") {
  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow">
    <title>Вход в админку | Ламарум</title>
    <style>
      :root { color-scheme: light; font-family: Inter, Arial, sans-serif; background: #f6f3ec; color: #172435; }
      * { box-sizing: border-box; }
      body { min-height: 100vh; margin: 0; display: grid; place-items: center; padding: 24px; }
      main { width: min(420px, 100%); border: 1px solid #dce2dd; border-radius: 8px; background: #fff; box-shadow: 0 18px 48px rgba(16, 36, 63, .12); }
      .head { padding: 24px 24px 0; }
      h1 { margin: 0; color: #102033; font-size: 30px; }
      p { margin: 8px 0 0; color: #657080; line-height: 1.6; }
      form { display: grid; gap: 14px; padding: 24px; }
      label { display: grid; gap: 7px; color: #102033; font-weight: 800; }
      input { min-height: 48px; border: 1px solid #dce2dd; border-radius: 8px; padding: 0 12px; color: #172435; background: #fbfdfe; font: inherit; }
      input:focus { outline: 0; border-color: #159783; box-shadow: 0 0 0 4px rgba(145, 234, 211, .35); }
      button { min-height: 48px; border: 0; border-radius: 8px; background: #f5a142; color: #111a25; font: inherit; font-weight: 900; cursor: pointer; }
      .error { margin: 0; padding: 12px 14px; border-radius: 8px; background: #fde8df; color: #8d2c13; font-weight: 800; }
    </style>
  </head>
  <body>
    <main>
      <div class="head">
        <h1>Вход в админку</h1>
        <p>Используйте логин администратора и пароль из переменной ADMIN_PASSWORD.</p>
      </div>
      <form method="post" action="/admin/login">
        ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
        <label>
          Логин
          <input name="username" type="text" value="${escapeHtml(getAdminUsername())}" autocomplete="username" required>
        </label>
        <label>
          Пароль
          <input name="password" type="password" autocomplete="current-password" required autofocus>
        </label>
        <button type="submit">Войти</button>
      </form>
    </main>
  </body>
</html>`;
}
