import "dotenv/config";

import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { submitApplication } from "./application-service.mjs";
import { createApplication, initializeDatabase, listApplications } from "./db.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(root, "dist");
const distAssetsDir = join(distDir, "assets");
const publicDir = join(root, "public");
const indexFile = join(distDir, "index.html");
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";
const staticOptions = {
  dotfiles: "ignore",
  fallthrough: true,
  index: false,
  maxAge: isProduction ? "1d" : 0,
};

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        scriptSrcElem: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        styleSrcElem: ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);

app.use("/api", cors(getApiCorsOptions));

app.use(
  express.json({
    limit: "10kb",
    type: ["application/json", "application/*+json"],
  }),
);

const leadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    ok: false,
    message: "Слишком много заявок. Попробуйте позже.",
  },
});

app.get("/health", (_request, response) => {
  response.status(200).type("text").send("OK");
});

app.get("/admin", requireAdminAuth, async (_request, response) => {
  try {
    const applications = await listApplications();
    response.set("Cache-Control", "no-store").type("html").send(buildAdminPage(applications));
  } catch (error) {
    console.error("Failed to load admin applications:", error.message);
    response.status(503).type("text").send("Не удалось загрузить заявки. Попробуйте позже.");
  }
});

app.post("/api/lead", requireJsonContentType, leadLimiter, async (request, response) => {
  const validation = validateLead(request.body);

  if (validation.honeypotFilled) {
    response.json({ ok: true });
    return;
  }

  if (!validation.ok) {
    response.status(400).json({ ok: false, message: validation.message });
    return;
  }

  try {
    await submitApplication(validation.data, {
      save: createApplication,
      notify: sendTelegramApplication,
      onNotificationError: (error, application) => {
        console.error(`Telegram delivery failed for application ${application.id}:`, error.message);
      },
    });
  } catch (error) {
    console.error("Failed to save application:", error.message);
    response.status(503).json({
      ok: false,
      message: "Не удалось принять заявку. Попробуйте ещё раз позже.",
    });
    return;
  }

  response.json({ ok: true });
});

app.all("/api/lead", (_request, response) => {
  response.set("Allow", "POST").status(405).json({
    ok: false,
    message: "Метод не поддерживается. Используйте POST.",
  });
});

app.use("/api", (_request, response) => {
  response.status(404).json({
    ok: false,
    message: "API route not found.",
  });
});

app.use("/assets", express.static(distAssetsDir, staticOptions));
app.use(express.static(distDir, staticOptions));
app.use(express.static(publicDir, staticOptions));

app.get("/", sendFrontend);
app.get("*", sendFrontend);

app.use((error, _request, response, _next) => {
  console.error("Unhandled server error:", error.message);

  const status = error.status === 413 ? 413 : error.type === "entity.parse.failed" ? 400 : 500;
  const message =
    status === 413
      ? "Слишком большой запрос."
      : status === 400
        ? "Некорректный JSON."
        : "Внутренняя ошибка сервера.";

  response.status(status).json({
    ok: false,
    message,
  });
});

startServer();

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(port, "0.0.0.0", () => {
      console.log(`Ламарум server: http://localhost:${port}/`);
    });
  } catch (error) {
    console.error("Database initialization failed:", error.message);
    process.exitCode = 1;
  }
}

function sendFrontend(_request, response, next) {
  if (!existsSync(indexFile)) {
    response.status(503).type("text").send("Frontend build not found. Run npm run build.");
    return;
  }

  response.sendFile(indexFile, (error) => {
    if (error) {
      next(error);
    }
  });
}

function getAllowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured;
  }

  if (isProduction) {
    return [];
  }

  return ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:5173", "http://127.0.0.1:5173"];
}

function getApiCorsOptions(request, callback) {
  const origin = request.get("origin");

  if (!origin) {
    callback(null, { origin: false });
    return;
  }

  const requestHost = request.get("host");
  let isSameOrigin = false;

  try {
    isSameOrigin = new URL(origin).host === requestHost;
  } catch {
    callback(new Error("Invalid Origin header"));
    return;
  }

  if (isSameOrigin || getAllowedOrigins().includes(origin)) {
    callback(null, { origin: true });
    return;
  }

  callback(new Error("Origin is not allowed by CORS"));
}

function requireJsonContentType(request, response, next) {
  if (!request.is("application/json")) {
    response.status(415).json({ ok: false, message: "Content-Type должен быть application/json." });
    return;
  }

  next();
}

function requireAdminAuth(request, response, next) {
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    response.status(503).type("text").send("Админ-страница не настроена.");
    return;
  }

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

  if (scheme !== "Basic" || username !== "admin" || !safeEqual(password, adminPassword)) {
    response.set("WWW-Authenticate", 'Basic realm="Ламарум заявки", charset="UTF-8"');
    response.status(401).type("text").send("Требуется авторизация.");
    return;
  }

  next();
}

function safeEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual));
  const expectedBuffer = Buffer.from(String(expected));

  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validateLength(value, min, max) {
  return value.length >= min && value.length <= max;
}

function validateLead(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Передайте данные заявки в формате JSON." };
  }

  const website = normalizeText(body.website);

  if (website) {
    return { ok: false, honeypotFilled: true };
  }

  const rawGoal = body.goal ?? body.comment;

  if ([body.name, body.contact, body.grade, rawGoal].some((value) => typeof value !== "string")) {
    return { ok: false, message: "Все поля заявки должны быть текстовыми." };
  }

  const name = normalizeText(body.name);
  const grade = normalizeText(body.grade);
  const contact = normalizeText(body.contact);
  const goal = normalizeText(rawGoal);

  if (!validateLength(name, 2, 60)) {
    return { ok: false, message: "Укажите имя от 2 до 60 символов." };
  }

  if (!validateLength(contact, 3, 80)) {
    return { ok: false, message: "Укажите контакт от 3 до 80 символов." };
  }

  if (!validateLength(grade, 1, 40)) {
    return { ok: false, message: "Укажите класс ученика." };
  }

  if (!validateLength(goal, 2, 1000)) {
    return { ok: false, message: "Опишите цель от 2 до 1000 символов." };
  }

  return {
    ok: true,
    data: { name, contact, grade, goal },
  };
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

function buildTelegramMessage(application) {
  return `<b>Новая заявка с сайта Ламарум</b>

Номер: ${escapeHtml(application.id)}
Имя: ${escapeHtml(application.name)}
Класс: ${escapeHtml(application.grade)}
Цель: ${escapeHtml(application.goal)}
Контакт: ${escapeHtml(application.contact)}`;
}

async function sendTelegramApplication(application) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_ID;

  if (!botToken || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing");
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      parse_mode: "HTML",
      text: buildTelegramMessage(application),
    }),
    signal: AbortSignal.timeout(8000),
  });

  const telegramResult = await telegramResponse.json();

  if (!telegramResponse.ok || !telegramResult.ok) {
    throw new Error("Telegram API rejected request");
  }
}

function buildAdminPage(applications) {
  const rows =
    applications.length > 0
      ? applications
          .map(
            (application) => `
              <tr>
                <td>${escapeHtml(application.id)}</td>
                <td>${escapeHtml(formatDate(application.created_at))}</td>
                <td>${escapeHtml(application.name)}</td>
                <td>${escapeHtml(application.contact)}</td>
                <td>${escapeHtml(application.grade)}</td>
                <td class="goal">${escapeHtml(application.goal)}</td>
                <td><span class="status">${escapeHtml(formatStatus(application.status))}</span></td>
              </tr>
            `,
          )
          .join("")
      : '<tr><td class="empty" colspan="7">Заявок пока нет.</td></tr>';

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow">
    <title>Заявки | Ламарум</title>
    <style>
      :root { color-scheme: light; font-family: Inter, Arial, sans-serif; background: #f4f1ea; color: #19231d; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 32px; }
      main { max-width: 1440px; margin: 0 auto; }
      header { display: flex; align-items: end; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
      h1 { margin: 0; font-size: clamp(28px, 4vw, 48px); }
      p { margin: 8px 0 0; color: #647068; }
      .table-wrap { overflow-x: auto; border: 1px solid #d9ded9; border-radius: 16px; background: #fff; box-shadow: 0 18px 60px rgba(33, 53, 41, .08); }
      table { width: 100%; border-collapse: collapse; min-width: 1050px; }
      th, td { padding: 14px 16px; border-bottom: 1px solid #e8ece8; text-align: left; vertical-align: top; }
      th { background: #edf3ee; color: #405047; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
      tr:last-child td { border-bottom: 0; }
      .goal { min-width: 300px; white-space: normal; }
      .status { display: inline-block; padding: 5px 10px; border-radius: 999px; background: #e4f5e8; color: #1f6b35; font-size: 13px; }
      .empty { padding: 48px; text-align: center; color: #647068; }
      @media (max-width: 720px) { body { padding: 18px; } header { align-items: start; flex-direction: column; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Заявки учеников</h1>
          <p>Последние ${applications.length} заявок, новые сверху.</p>
        </div>
        <p>Обновлено: ${escapeHtml(formatDate(new Date()))}</p>
      </header>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Создана</th>
              <th>Имя</th>
              <th>Контакт</th>
              <th>Класс</th>
              <th>Цель</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </main>
  </body>
</html>`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Moscow",
  }).format(new Date(value));
}

function formatStatus(status) {
  return status === "new" ? "Новая" : status;
}
