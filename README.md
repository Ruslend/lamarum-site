# Ламарум

Сайт онлайн-школы «Ламарум»: React/Vite frontend и Node.js backend с PostgreSQL, Telegram-уведомлениями и защищённой страницей заявок.

## Переменные окружения

Создайте `.env` в корне проекта:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/lamarum
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
ADMIN_PASSWORD=use_a_long_random_password_here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://lamarum-site.onrender.com
PGSSLROOTCERT=C:/Users/Ruslan/.cloud-certs/root.crt
# DB_SSL_REJECT_UNAUTHORIZED=false
NODE_ENV=production
PORT=3000
```

- `DATABASE_URL` — строка подключения PostgreSQL.
- `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID` — данные для уведомлений.
- `ADMIN_PASSWORD` — длинный случайный пароль для `/admin`; логин всегда `admin`.
- `ALLOWED_ORIGINS` — разрешённые дополнительные origin для API.
- `PGSSLROOTCERT` — путь к CA-сертификату PostgreSQL, например сертификату Timeweb.
- `DB_SSL_REJECT_UNAUTHORIZED=false` — только для локальной диагностики SSL, если нужно временно отключить проверку сертификата.

Не загружайте `.env` в GitHub.

Если `DATABASE_URL` не задан, сервер всё равно отдаёт главную страницу. Расписание и формы, которым нужна база, покажут понятное сообщение о временной недоступности, а `/admin/schedule` ответит: `База данных не настроена`.

## Запуск

```powershell
npm.cmd install
npm.cmd run build
npm.cmd start
```

При запуске сервер автоматически создаёт таблицы `applications`, `schedule_slots`, `trial_bookings` и индексы по дате. Полная схема находится в `db.mjs`; базовая таблица прежних заявок выглядит так:

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

Новая форма записи на пробный урок отправляет `POST /api/bookings`. Сервер:

1. Проверяет обязательные поля и длину текста.
2. Применяет rate limit: не более 5 попыток с одного IP за 10 минут.
3. Отсекает простых ботов через скрытое honeypot-поле.
4. Проверяет, что выбранный слот существует и свободен.
5. Сохраняет запись в PostgreSQL и переводит слот в статус `booked`.
6. Пытается отправить Telegram-уведомление.

Если Telegram недоступен, сохранённая запись не теряется, а форма всё равно получает успешный ответ. Ошибки PostgreSQL логируются только на сервере; пользователю возвращается общее безопасное сообщение.

Старый endpoint `POST /api/lead` оставлен для совместимости с прежней формой заявки.

## Расписание

Публичное расписание загружается через:

```text
GET /api/schedule
```

Если таблица слотов пустая, при первом запуске сервер добавит несколько ближайших свободных слотов-заготовок. Дальше расписанием удобнее управлять из админки.

## Админ-страница

Откройте:

```text
http://localhost:3000/admin/schedule
```

Браузер запросит Basic Auth:

```text
Логин: admin
Пароль: значение ADMIN_PASSWORD
```

Страница показывает все слоты, позволяет добавить слот, удалить слот, переключить статус `свободно / занято`, посмотреть записи на пробный урок и заявки со старой формы. Кеширование запрещено.

## Деплой

Для Render можно использовать `render.yaml`: Blueprint создаст PostgreSQL-базу и автоматически передаст её строку подключения в `DATABASE_URL`. Telegram-переменные и `ADMIN_PASSWORD` задайте вручную. Для Railway добавьте PostgreSQL-сервис и передайте его строку подключения в `DATABASE_URL`.

Администратор должен один раз открыть Telegram-бота и нажать `/start`, иначе Telegram не позволит боту написать первым.

### VPS с PM2 и Nginx

После каждого обновления установите зависимости, пересоберите `dist` и перезапустите PM2:

```bash
cd /var/www/lamarum-site
npm install
npm run build
pm2 delete lamarum-site
pm2 start ecosystem.config.cjs
pm2 save
```

`ecosystem.config.cjs` фиксирует рабочий каталог `/var/www/lamarum-site`, запускает `server.mjs` через Node.js с загрузкой `.env` и задаёт `NODE_ENV=production`.

Nginx должен проксировать запросы без изменения пути на `http://127.0.0.1:3000`. Пока сайт доступен по HTTP-IP, CSP сервера не включает `upgrade-insecure-requests`, иначе браузер попытается загрузить `/assets/*` по недоступному HTTPS. После подключения домена и TLS настройте перенаправление с HTTP на HTTPS в Nginx.
