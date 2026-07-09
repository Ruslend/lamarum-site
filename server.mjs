import "dotenv/config";

import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleAdminLogin, handleAdminLogout, requireAdminAuth, showAdminLogin } from "./admin-auth.mjs";
import { submitTrialBooking } from "./booking-service.mjs";
import { submitApplication } from "./application-service.mjs";
import {
  createApplication,
  createScheduleSlot,
  createTrialBooking,
  deleteScheduleSlot,
  initializeDatabase,
  isDatabaseConfigured,
  listApplications,
  listScheduleSlots,
  listTrialBookings,
  toggleScheduleSlotStatus,
} from "./db.mjs";

const serverFile = fileURLToPath(import.meta.url);
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
        upgradeInsecureRequests: null,
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

app.use(
  express.urlencoded({
    extended: false,
    limit: "10kb",
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

app.get("/admin/login", showAdminLogin);
app.post("/admin/login", handleAdminLogin);
app.post("/admin/logout", handleAdminLogout);

app.get(["/admin", "/admin/schedule"], requireAdminAuth, requireDatabaseForAdmin, async (_request, response) => {
  try {
    const { slots, trialBookings, applications } = await loadAdminScheduleData();
    response
      .set("Cache-Control", "no-store")
      .type("html")
      .send(buildScheduleAdminPage({ slots, trialBookings, applications }));
  } catch (error) {
    console.error("Failed to load admin schedule:", {
      step: error.adminStep || "unknown",
      message: error.message,
      stack: error.stack,
    });
    response
      .status(503)
      .set("Cache-Control", "no-store")
      .type("html")
      .send(buildAdminErrorPage(error));
  }
});

app.post("/admin/schedule/slots", requireAdminAuth, requireDatabaseForAdmin, async (request, response) => {
  const validation = validateAdminSlot(request.body);

  if (!validation.ok) {
    response.status(400).type("text").send(validation.message);
    return;
  }

  try {
    await createScheduleSlot(validation.data);
    response.redirect(303, "/admin/schedule");
  } catch (error) {
    console.error("Failed to create schedule slot:", error.message);
    response.status(503).type("text").send("Не удалось добавить слот.");
  }
});

app.post("/admin/schedule/slots/:id/toggle", requireAdminAuth, requireDatabaseForAdmin, async (request, response) => {
  try {
    const slot = await toggleScheduleSlotStatus(request.params.id);

    if (!slot) {
      response.status(404).type("text").send("Слот не найден.");
      return;
    }

    response.redirect(303, "/admin/schedule");
  } catch (error) {
    console.error("Failed to toggle schedule slot:", error.message);
    response.status(503).type("text").send("Не удалось изменить статус слота.");
  }
});

app.post("/admin/schedule/slots/:id/delete", requireAdminAuth, requireDatabaseForAdmin, async (request, response) => {
  try {
    await deleteScheduleSlot(request.params.id);
    response.redirect(303, "/admin/schedule");
  } catch (error) {
    console.error("Failed to delete schedule slot:", error.message);
    response.status(503).type("text").send("Не удалось удалить слот.");
  }
});

app.get("/api/schedule", async (_request, response) => {
  if (!isDatabaseConfigured()) {
    response.status(503).json({
      ok: false,
      message: "Расписание временно недоступно. Можно записаться через Telegram",
    });
    return;
  }

  try {
    const slots = await listScheduleSlots();
    response.set("Cache-Control", "no-store").json({ ok: true, slots });
  } catch (error) {
    console.error("Failed to load schedule slots:", error.message);
    response.status(503).json({
      ok: false,
      message: "Расписание временно недоступно.",
    });
  }
});

app.post("/api/bookings", requireJsonContentType, leadLimiter, async (request, response) => {
  if (!isDatabaseConfigured()) {
    response.status(503).json({
      ok: false,
      message: "Расписание временно недоступно. Можно записаться через Telegram",
    });
    return;
  }

  const validation = validateBooking(request.body);

  if (validation.honeypotFilled) {
    response.json({ ok: true });
    return;
  }

  if (!validation.ok) {
    response.status(400).json({ ok: false, message: validation.message });
    return;
  }

  try {
    const booking = await submitTrialBooking(validation.data, {
      book: createTrialBooking,
      notify: sendTelegramBooking,
      onNotificationError: (error, booking) => {
        console.error(`Telegram delivery failed for booking ${booking.id}:`, error.message);
      },
    });

    response.json({ ok: true, booking });
  } catch (error) {
    if (error.code === "SLOT_NOT_FOUND" || error.code === "SLOT_UNAVAILABLE") {
      response.status(409).json({ ok: false, message: error.message });
      return;
    }

    console.error("Failed to create trial booking:", error.message);
    response.status(503).json({
      ok: false,
      message: "Не удалось принять запись. Попробуйте ещё раз позже.",
    });
  }
});

app.all("/api/bookings", (_request, response) => {
  response.set("Allow", "POST").status(405).json({
    ok: false,
    message: "Метод не поддерживается. Используйте POST.",
  });
});

app.all("/api/schedule", (_request, response) => {
  response.set("Allow", "GET").status(405).json({
    ok: false,
    message: "Метод не поддерживается. Используйте GET.",
  });
});

app.get("/admin/applications", requireAdminAuth, requireDatabaseForAdmin, async (_request, response) => {
  try {
    const applications = await listApplications();
    response.set("Cache-Control", "no-store").type("html").send(buildAdminPage(applications));
  } catch (error) {
    console.error("Failed to load admin applications:", error.message);
    response.status(503).type("text").send("Не удалось загрузить заявки. Попробуйте позже.");
  }
});

app.post("/api/lead", requireJsonContentType, leadLimiter, async (request, response) => {
  if (!isDatabaseConfigured()) {
    response.status(503).json({
      ok: false,
      message: "База данных не настроена.",
    });
    return;
  }

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
app.use("/assets", (_request, response) => {
  response.status(404).type("text").send("Asset not found.");
});
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

if (process.argv[1] && resolve(process.argv[1]) === serverFile) {
  startServer();
}

export { app, buildScheduleAdminPage, startServer };

async function startServer() {
  try {
    const databaseReady = await initializeDatabase();

    if (!databaseReady) {
      console.warn("DATABASE_URL is missing. Ламарум server started without database features.");
    }

    app.listen(port, "0.0.0.0", () => {
      console.log(`Ламарум server: http://localhost:${port}/`);
    });
  } catch (error) {
    console.error("Database initialization failed:", error.message);
    process.exitCode = 1;
  }
}

function requireDatabaseForAdmin(_request, response, next) {
  if (!isDatabaseConfigured()) {
    response.set("Cache-Control", "no-store").status(503).type("text").send("База данных не настроена");
    return;
  }

  next();
}

async function loadAdminScheduleData() {
  const slots = await runAdminQuery("загрузка слотов расписания", listScheduleSlots);
  const trialBookings = await runAdminQuery("загрузка записей на пробный урок", listTrialBookings);
  const applications = await runAdminQuery("загрузка заявок со старой формы", listApplications);

  return { slots, trialBookings, applications };
}

async function runAdminQuery(adminStep, query) {
  try {
    return await query();
  } catch (error) {
    error.adminStep = adminStep;
    throw error;
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

function validateBooking(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Передайте данные записи в формате JSON." };
  }

  const website = normalizeText(body.website);

  if (website) {
    return { ok: false, honeypotFilled: true };
  }

  const parentNameRaw = body.parentName ?? body.parent_name;
  const studentNameRaw = body.studentName ?? body.student_name;
  const slotIdRaw = body.slotId ?? body.slot_id ?? body.selectedSlotId;
  const consentRaw = body.consent ?? body.personalDataConsent;

  if (
    [parentNameRaw, studentNameRaw, body.grade, body.contact, slotIdRaw].some(
      (value) => typeof value !== "string",
    )
  ) {
    return { ok: false, message: "Заполните обязательные поля записи." };
  }

  const parentName = normalizeText(parentNameRaw);
  const studentName = normalizeText(studentNameRaw);
  const grade = normalizeText(body.grade);
  const contact = normalizeText(body.contact);
  const goal = normalizeText(body.goal);
  const comment = normalizeText(body.comment);
  const slotId = normalizeText(slotIdRaw);
  const hasConsent = consentRaw === true || consentRaw === "true" || consentRaw === "on";

  if (!validateLength(parentName, 2, 80)) {
    return { ok: false, message: "Укажите имя родителя от 2 до 80 символов." };
  }

  if (!validateLength(studentName, 2, 80)) {
    return { ok: false, message: "Укажите имя ученика от 2 до 80 символов." };
  }

  if (!validateLength(grade, 1, 40)) {
    return { ok: false, message: "Укажите класс ученика." };
  }

  if (!validateLength(contact, 3, 80)) {
    return { ok: false, message: "Укажите Telegram или телефон от 3 до 80 символов." };
  }

  if (!/^\d+$/.test(slotId)) {
    return { ok: false, message: "Выберите слот из расписания." };
  }

  if (goal.length > 1000 || comment.length > 1000) {
    return { ok: false, message: "Цель и комментарий должны быть короче 1000 символов." };
  }

  if (!hasConsent) {
    return { ok: false, message: "Нужно согласие на обработку персональных данных." };
  }

  return {
    ok: true,
    data: {
      parentName,
      studentName,
      grade,
      contact,
      goal,
      comment,
      slotId,
    },
  };
}

function validateAdminSlot(body) {
  const date = normalizeText(body.date);
  const time = normalizeText(body.time);
  const status = normalizeText(body.status) || "available";

  if (!isValidIsoDate(date)) {
    return { ok: false, message: "Укажите дату в формате YYYY-MM-DD." };
  }

  if (!isValidTime(time)) {
    return { ok: false, message: "Укажите время в формате HH:MM." };
  }

  if (!["available", "booked"].includes(status)) {
    return { ok: false, message: "Статус должен быть available или booked." };
  }

  return {
    ok: true,
    data: { date, time, status },
  };
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function isValidTime(value) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }

  const [hours, minutes] = value.split(":").map(Number);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
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

function buildTelegramBookingMessage(booking) {
  return `<b>Новая запись на пробный урок Lamarum</b>

Родитель: ${escapeHtml(booking.parent_name)}
Ученик: ${escapeHtml(booking.student_name)}
Класс: ${escapeHtml(booking.grade)}
Контакт: ${escapeHtml(booking.contact)}
Выбранный слот: ${escapeHtml(booking.slot_label)}
Цель: ${escapeHtml(booking.goal || "Не указана")}
Комментарий: ${escapeHtml(booking.comment || "Не указан")}`;
}

async function sendTelegramBooking(booking) {
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
      text: buildTelegramBookingMessage(booking),
    }),
    signal: AbortSignal.timeout(8000),
  });

  const telegramResult = await telegramResponse.json();

  if (!telegramResponse.ok || !telegramResult.ok) {
    throw new Error("Telegram API rejected request");
  }
}

function buildAdminErrorPage(error) {
  const step = error.adminStep || "загрузка админки";
  const message = error.message || "Неизвестная ошибка";

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow">
    <title>Ошибка админки | Ламарум</title>
    <style>
      :root { color-scheme: light; font-family: Inter, Arial, sans-serif; background: #f6f3ec; color: #172435; }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 30px; }
      main { max-width: 860px; margin: 0 auto; border: 1px solid #dce2dd; border-radius: 8px; background: #fff; box-shadow: 0 14px 38px rgba(16, 36, 63, .08); padding: 24px; }
      h1 { margin: 0; color: #102033; font-size: clamp(28px, 4vw, 42px); }
      p { color: #657080; line-height: 1.65; }
      dl { display: grid; gap: 12px; margin: 22px 0; }
      div { padding: 14px; border-radius: 8px; background: #fbfdfe; border: 1px solid #e7ebe8; }
      dt { color: #126d60; font-size: 12px; font-weight: 900; text-transform: uppercase; }
      dd { margin: 6px 0 0; color: #172435; font-weight: 750; overflow-wrap: anywhere; }
      a, button { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; border: 0; border-radius: 8px; padding: 0 14px; background: #e8fbf5; color: #102033; font: inherit; font-weight: 900; text-decoration: none; cursor: pointer; }
      form { display: inline; margin-left: 8px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Админка не загрузилась</h1>
      <p>Backend не смог получить данные для страницы. Подробность ниже поможет понять, какую таблицу или запрос нужно проверить.</p>
      <dl>
        <div>
          <dt>Шаг</dt>
          <dd>${escapeHtml(step)}</dd>
        </div>
        <div>
          <dt>Ошибка</dt>
          <dd>${escapeHtml(message)}</dd>
        </div>
      </dl>
      <a href="/admin/schedule">Обновить</a>
      <form method="post" action="/admin/logout"><button type="submit">Выйти</button></form>
    </main>
  </body>
</html>`;
}

function buildScheduleAdminPage({ slots, trialBookings, applications }) {
  const slotsRows =
    slots.length > 0
      ? slots
          .map(
            (slot) => `
              <tr>
                <td>${escapeHtml(slot.id)}</td>
                <td>${escapeHtml(slot.weekday)}</td>
                <td>${escapeHtml(formatPlainDate(slot.date))}</td>
                <td>${escapeHtml(slot.time)}</td>
                <td><span class="status ${slot.status}">${escapeHtml(formatSlotStatus(slot.status))}</span></td>
                <td class="actions">
                  <form method="post" action="/admin/schedule/slots/${escapeHtml(slot.id)}/toggle">
                    <button type="submit">${slot.status === "available" ? "Сделать занятым" : "Освободить"}</button>
                  </form>
                  <form method="post" action="/admin/schedule/slots/${escapeHtml(slot.id)}/delete">
                    <button class="danger" type="submit">Удалить</button>
                  </form>
                </td>
              </tr>
            `,
          )
          .join("")
      : '<tr><td class="empty" colspan="6">Слотов пока нет. Добавьте первое время выше.</td></tr>';

  const trialRows =
    trialBookings.length > 0
      ? trialBookings
          .map(
            (booking) => `
              <tr>
                <td>${escapeHtml(booking.id)}</td>
                <td>${escapeHtml(formatDate(booking.created_at))}</td>
                <td>${escapeHtml(booking.parent_name)}</td>
                <td>${escapeHtml(booking.student_name)}</td>
                <td>${escapeHtml(booking.grade)}</td>
                <td>${escapeHtml(booking.contact)}</td>
                <td>${escapeHtml(booking.slot_label)}</td>
                <td class="goal">
                  <strong>Цель:</strong> ${escapeHtml(booking.goal || "Не указана")}<br>
                  <strong>Комментарий:</strong> ${escapeHtml(booking.comment || "Не указан")}
                </td>
                <td><span class="status">${escapeHtml(formatStatus(booking.status))}</span></td>
              </tr>
            `,
          )
          .join("")
      : '<tr><td class="empty" colspan="9">Записей на пробный урок пока нет.</td></tr>';

  const legacyRows =
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
      : '<tr><td class="empty" colspan="7">Заявок со старой формы пока нет.</td></tr>';

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow">
    <title>Расписание и записи | Ламарум</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, Arial, sans-serif;
        background: #f6f3ec;
        color: #172435;
      }
      * { box-sizing: border-box; }
      body { margin: 0; padding: 30px; }
      main { max-width: 1480px; margin: 0 auto; }
      header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 24px;
      }
      .header-actions { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
      .header-actions form { margin: 0; }
      h1, h2 { margin: 0; color: #102033; }
      h1 { font-size: clamp(30px, 4vw, 48px); }
      h2 { font-size: 24px; }
      p { margin: 8px 0 0; color: #657080; }
      a { color: #126d60; font-weight: 800; }
      .grid { display: grid; grid-template-columns: minmax(280px, 360px) 1fr; gap: 18px; align-items: start; }
      .panel {
        border: 1px solid #dce2dd;
        border-radius: 8px;
        background: #fff;
        box-shadow: 0 14px 38px rgba(16, 36, 63, .08);
      }
      .panel-head { padding: 20px 20px 0; }
      .slot-form { display: grid; gap: 14px; padding: 20px; }
      label { display: grid; gap: 7px; color: #102033; font-weight: 800; }
      input, select {
        min-height: 44px;
        border: 1px solid #dce2dd;
        border-radius: 8px;
        padding: 0 12px;
        color: #172435;
        background: #fbfdfe;
      }
      button {
        min-height: 38px;
        border: 0;
        border-radius: 8px;
        padding: 0 12px;
        background: #e8fbf5;
        color: #102033;
        font-weight: 800;
        cursor: pointer;
      }
      button.primary { min-height: 46px; background: #f5a142; }
      button.danger { background: #fde8df; color: #8d2c13; }
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; min-width: 980px; }
      th, td { padding: 13px 14px; border-bottom: 1px solid #e7ebe8; text-align: left; vertical-align: top; }
      th { background: #edf6f1; color: #41534b; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; }
      tr:last-child td { border-bottom: 0; }
      .actions { display: flex; gap: 8px; flex-wrap: wrap; min-width: 250px; }
      .actions form { margin: 0; }
      .goal { min-width: 300px; white-space: normal; line-height: 1.6; }
      .status {
        display: inline-flex;
        min-height: 28px;
        align-items: center;
        padding: 0 10px;
        border-radius: 999px;
        background: #e8f5ed;
        color: #1f6b35;
        font-size: 13px;
        font-weight: 800;
      }
      .status.booked { background: #f8e6df; color: #8d2c13; }
      .empty { padding: 42px; text-align: center; color: #657080; }
      .section-stack { display: grid; gap: 18px; margin-top: 18px; }
      @media (max-width: 940px) {
        body { padding: 18px; }
        header { align-items: start; flex-direction: column; }
        .header-actions { justify-content: flex-start; }
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Расписание и записи</h1>
          <p>Слоты пробных уроков, новые записи и заявки со старой формы.</p>
        </div>
        <div class="header-actions">
          <p>Обновлено: ${escapeHtml(formatDate(new Date()))}</p>
          <form method="post" action="/admin/logout"><button type="submit">Выйти</button></form>
        </div>
      </header>

      <div class="grid">
        <section class="panel">
          <div class="panel-head">
            <h2>Добавить слот</h2>
            <p>После добавления слот появится на главной странице.</p>
          </div>
          <form class="slot-form" method="post" action="/admin/schedule/slots">
            <label>
              Дата
              <input name="date" type="date" value="${escapeHtml(getTomorrowIsoDate())}" required>
            </label>
            <label>
              Время
              <input name="time" type="time" value="18:00" required>
            </label>
            <label>
              Статус
              <select name="status">
                <option value="available">Свободно</option>
                <option value="booked">Занято</option>
              </select>
            </label>
            <button class="primary" type="submit">Добавить слот</button>
          </form>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Все слоты</h2>
            <p>Свободный слот можно занять вручную, занятый слот можно снова открыть.</p>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>День</th>
                  <th>Дата</th>
                  <th>Время</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>${slotsRows}</tbody>
            </table>
          </div>
        </section>
      </div>

      <div class="section-stack">
        <section class="panel">
          <div class="panel-head">
            <h2>Записи на пробный урок</h2>
            <p>Последние ${trialBookings.length} записей, новые сверху.</p>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Создана</th>
                  <th>Родитель</th>
                  <th>Ученик</th>
                  <th>Класс</th>
                  <th>Контакт</th>
                  <th>Слот</th>
                  <th>Детали</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>${trialRows}</tbody>
            </table>
          </div>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Заявки со старой формы</h2>
            <p>Оставлено для совместимости с прежней формой заявки.</p>
          </div>
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
              <tbody>${legacyRows}</tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  </body>
</html>`;
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

function getTomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatLocalIsoDate(date);
}

function formatPlainDate(value) {
  const plainDate = parsePlainDate(value);

  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(plainDate.year, plainDate.month - 1, plainDate.day, 12, 0, 0));
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

function formatSlotStatus(status) {
  return status === "available" ? "Свободно" : "Занято";
}

function parsePlainDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);

  return { year, month, day };
}

function formatLocalIsoDate(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
