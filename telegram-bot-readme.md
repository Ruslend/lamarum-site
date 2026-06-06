# Telegram-бот школы «Ламарум»

Бот записывает учеников на бесплатный пробный урок по ОГЭ информатике и отправляет заявку администратору.

## Файлы проекта

- `main.py` — точка запуска бота.
- `lamarum_bot/config.py` — загрузка `BOT_TOKEN` и `ADMIN_ID` из `.env`.
- `lamarum_bot/handlers.py` — команды, кнопки, анкета и отправка заявки администратору.
- `lamarum_bot/keyboards.py` — кнопки главного меню и кнопка «Назад в меню».
- `lamarum_bot/states.py` — состояния анкеты пробного урока.
- `lamarum_bot/texts.py` — тексты разделов.
- `requirements.txt` — зависимости.
- `.env.example` — пример файла с секретами.

## Куда вставить BOT_TOKEN

1. Создайте файл `.env` в корне проекта.
2. Скопируйте в него содержимое `.env.example`.
3. Вставьте токен от BotFather:

```env
BOT_TOKEN=ваш_токен_бота
ADMIN_ID=ваш_telegram_id
```

Токен нельзя вставлять в код. Файл `.env` добавлен в `.gitignore`.

## Куда вставить ADMIN_ID

В тот же файл `.env`:

```env
ADMIN_ID=ваш_числовой_telegram_id
```

`ADMIN_ID` — это числовой Telegram ID человека, которому будут приходить заявки.

Как узнать свой ID:
1. Откройте в Telegram бота `@userinfobot`.
2. Нажмите Start.
3. Скопируйте значение `Id`.

## Как установить зависимости

```powershell
cd "C:\Users\Ruslan\Documents\Ламарум"
pip install -r requirements.txt
```

## Как запустить бота

```powershell
python main.py
```

Если всё настроено правильно, бот начнёт отвечать в Telegram.

## Как остановить бота

В терминале нажмите:

```text
Ctrl + C
```
