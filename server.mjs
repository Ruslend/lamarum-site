import "dotenv/config";

import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const distDir = join(root, "dist");
const publicDir = existsSync(distDir) ? distDir : root;
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === "production";

const app = express();

app.disable("x-powered-by");

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
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }),
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigins = getAllowedOrigins();

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin is not allowed by CORS"));
    },
  }),
);

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
    await sendTelegramLead(validation.data);
    response.json({ ok: true });
  } catch (error) {
    if (!isProduction) {
      console.error("Telegram delivery failed:", error.message);
    }

    response.status(502).json({
      ok: false,
      message: "Не удалось отправить заявку. Напишите напрямую в Telegram: @ruslannzz.",
    });
  }
});

app.all("/api/lead", (_request, response) => {
  response.set("Allow", "POST").status(405).json({
    ok: false,
    message: "Метод не поддерживается. Используйте POST.",
  });
});

app.use(express.static(publicDir, { dotfiles: "ignore" }));

if (!existsSync(distDir)) {
  app.use("/src", express.static(join(root, "src"), { dotfiles: "ignore" }));
}

app.get("*", async (_request, response) => {
  const fallbackFile = existsSync(distDir) ? join(distDir, "index.html") : join(root, "preview.html");
  response.type("html").send(await readFile(fallbackFile, "utf-8"));
});

app.use((error, _request, response, _next) => {
  if (!isProduction) {
    console.error(error.message);
  }

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

app.listen(port, "0.0.0.0", () => {
  console.log(`Ламарум server: http://localhost:${port}/`);
});

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

  const name = normalizeText(body.name);
  const grade = normalizeText(body.grade);
  const contact = normalizeText(body.contact);
  const comment = normalizeText(body.comment);

  if (!validateLength(name, 2, 60)) {
    return { ok: false, message: "Укажите имя от 2 до 60 символов." };
  }

  if (!validateLength(grade, 2, 40)) {
    return { ok: false, message: "Укажите класс ученика." };
  }

  if (!validateLength(contact, 3, 80)) {
    return { ok: false, message: "Укажите Telegram для связи от 3 до 80 символов." };
  }

  if (!validateLength(comment, 2, 1000)) {
    return { ok: false, message: "Опишите сложность от 2 до 1000 символов." };
  }

  return {
    ok: true,
    data: { name, grade, contact, comment },
  };
}

function escapeTelegram(value) {
  return value.replace(/[<>&]/g, (character) => {
    const replacements = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
    };

    return replacements[character];
  });
}

function buildLeadMessage(data) {
  return `Новая заявка с сайта Ламарум 🦙

Имя: ${escapeTelegram(data.name)}
Класс: ${escapeTelegram(data.grade)}
Сложности: ${escapeTelegram(data.comment)}
Контакт: ${escapeTelegram(data.contact)}`;
}

async function sendTelegramLead(data) {
  const botToken = process.env.BOT_TOKEN;
  const adminId = process.env.ADMIN_ID;

  if (!botToken || !adminId) {
    throw new Error("BOT_TOKEN or ADMIN_ID is missing");
  }

  const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: adminId,
      parse_mode: "HTML",
      text: buildLeadMessage(data),
    }),
  });

  const telegramResult = await telegramResponse.json();

  if (!telegramResult.ok) {
    throw new Error("Telegram API rejected request");
  }
}
