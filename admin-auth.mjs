import { timingSafeEqual } from "node:crypto";

export function requireAdminAuth(request, response, next) {
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
    response.set("WWW-Authenticate", 'Basic realm="Admin Area"');
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
