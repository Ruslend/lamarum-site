# Ламарум

Сайт онлайн-школы «Ламарум»: React/Vite frontend и Node.js backend с PostgreSQL, Telegram-уведомлениями и защищённой страницей заявок.

## Переменные окружения

Создайте `.env` в корне проекта:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/lamarum
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
ADMIN_PASSWORD=use_a_long_random_password_here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://your-domain.ru
NODE_ENV=production
PORT=3000
```

- `DATABASE_URL` — строка подключения PostgreSQL.
- `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` — данные для уведомлений.
- `ADMIN_PASSWORD` — длинный случайный пароль для `/admin`; логин всегда `admin`.
- `ALLOWED_ORIGINS` — разрешённые дополнительные origin для API.

Не загружайте `.env` в GitHub.

## Запуск

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

При запуске сервер автоматически создаёт таблицу `applications` и индекс по дате:

```sql
CREATE TABLE applications (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  contact VARCHAR(80) NOT NULL,
  grade VARCHAR(40) NOT NULL,
  goal VARCHAR(1000) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

## Как работает заявка

Форма отправляет `POST /api/lead`. Сервер:

1. Проверяет обязательные поля и длину текста.
2. Применяет rate limit: не более 5 попыток с одного IP за 10 минут.
3. Отсекает простых ботов через скрытое honeypot-поле.
4. Сохраняет заявку в PostgreSQL.
5. Пытается отправить Telegram-уведомление.

Если Telegram недоступен, сохранённая заявка не теряется, а форма всё равно получает успешный ответ. Ошибки PostgreSQL логируются только на сервере; пользователю возвращается общее безопасное сообщение.

## Админ-страница

Откройте:

```text
http://localhost:3000/admin
```

Браузер запросит Basic Auth:

```text
Логин: admin
Пароль: значение ADMIN_PASSWORD
```

Страница показывает последние 200 заявок и запрещает кеширование.

## Деплой

Для Render можно использовать `render.yaml`: Blueprint создаст PostgreSQL-базу и автоматически передаст её строку подключения в `DATABASE_URL`. Telegram-переменные и `ADMIN_PASSWORD` задайте вручную. Для Railway добавьте PostgreSQL-сервис и передайте его строку подключения в `DATABASE_URL`.

Администратор должен один раз открыть Telegram-бота и нажать `/start`, иначе Telegram не позволит боту написать первым.

### VPS с PM2 и Nginx

После каждого обновления установите зависимости, пересоберите `dist` и перезапустите PM2:

```bash
npm install
npm run build
pm2 restart lamarum-site
```

Nginx должен проксировать запросы без изменения пути на `http://127.0.0.1:3000`. Пока сайт доступен по HTTP-IP, CSP сервера не включает `upgrade-insecure-requests`, иначе браузер попытается загрузить `/assets/*` по недоступному HTTPS. После подключения домена и TLS настройте перенаправление с HTTP на HTTPS в Nginx.
