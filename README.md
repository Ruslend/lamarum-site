# Ламарум

Сайт онлайн-школы «Ламарум» для подготовки к ОГЭ по информатике. Проект включает React/Vite frontend, Node.js backend и endpoint `/api/lead`, который отправляет заявки в Telegram.

## Что внутри

- `src/` — React-сайт и стили.
- `server.mjs` — production-сервер, раздача frontend и API для заявок.
- `public/` — favicon, robots.txt, sitemap.xml и Open Graph изображение.
- `lamarum_bot/` — отдельный Telegram-бот для записи на пробный урок.
- `.env.example` — пример переменных окружения без секретов.

## Переменные окружения

Создайте `.env` в корне проекта:

```env
BOT_TOKEN=your_telegram_bot_token_here
ADMIN_ID=your_telegram_admin_id_here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://your-domain.ru
NODE_ENV=production
PORT=3000
```

Нельзя загружать `.env` в GitHub. Токен бота и ID администратора должны храниться только в переменных окружения.

## Установка на Windows

```powershell
cd "C:\Users\Ruslan\Documents\ламарум"
npm.cmd install
```

## Локальная разработка frontend

```powershell
npm.cmd run dev
```

## Production-сборка и запуск

```powershell
npm.cmd run build
npm.cmd start
```

После запуска сайт будет доступен на порту из `PORT`, по умолчанию:

```text
http://localhost:3000/
```

## Проверка формы

Форма отправляет `POST /api/lead` на backend. Backend проверяет данные, применяет rate limit и отправляет заявку в Telegram через `BOT_TOKEN` и `ADMIN_ID`.

Администратор должен один раз открыть Telegram-бота и нажать `/start`, иначе Telegram не позволит боту написать первым.

## Защита backend

Добавлено:

- `helmet` для HTTP-заголовков безопасности;
- `express-rate-limit` для ограничения заявок;
- `cors` с доменами из `ALLOWED_ORIGINS`;
- `express.json` с лимитом `10kb`;
- запрет `X-Powered-By`;
- проверка `Content-Type`;
- строгая валидация длины полей;
- honeypot-поле против простых ботов;
- экранирование данных перед отправкой в Telegram;
- отсутствие секретов во frontend-коде.

## Деплой на Render

1. Создайте новый Web Service.
2. Подключите GitHub-репозиторий.
3. Укажите:

```text
Build Command: npm install && npm run build
Start Command: npm start
```

4. В Environment Variables добавьте:

```text
NODE_ENV=production
BOT_TOKEN=...
ADMIN_ID=...
ALLOWED_ORIGINS=https://your-render-domain.onrender.com,https://your-domain.ru
PORT=3000
```

Также можно использовать `render.yaml` из проекта.

## Деплой на Railway

1. Создайте проект Railway из GitHub-репозитория.
2. Добавьте переменные окружения из `.env.example`.
3. Railway сам выполнит `npm install`.
4. В настройках запуска укажите `npm start`, если Railway не определит команду автоматически.

## GitHub

Перед публикацией проверьте:

- `.env` не попадает в репозиторий;
- `node_modules`, `dist`, временные Python-пакеты и логи игнорируются;
- в коде нет реального `BOT_TOKEN`;
- в публичных файлах нет реального `ADMIN_ID`.

Команды для ручной загрузки:

```powershell
git init
git add .
git commit -m "Prepare site for production deployment"
git branch -M main
git remote add origin https://github.com/USERNAME/lamarum-site.git
git push -u origin main
```

Замените `USERNAME` на свой GitHub-логин.
