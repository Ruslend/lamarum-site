from aiogram.types import KeyboardButton, ReplyKeyboardMarkup

TRIAL_BUTTON = "🎁 Записаться на пробный урок"
COURSES_BUTTON = "📚 Узнать про курсы"
PROCESS_BUTTON = "💻 Как проходит обучение"
PRICES_BUTTON = "💰 Цены"
FAQ_BUTTON = "❓ Частые вопросы"
CONTACT_BUTTON = "📞 Связаться с преподавателем"
BACK_BUTTON = "⬅️ Назад в меню"


def main_menu_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=TRIAL_BUTTON)],
            [KeyboardButton(text=COURSES_BUTTON), KeyboardButton(text=PROCESS_BUTTON)],
            [KeyboardButton(text=PRICES_BUTTON), KeyboardButton(text=FAQ_BUTTON)],
            [KeyboardButton(text=CONTACT_BUTTON)],
        ],
        resize_keyboard=True,
        input_field_placeholder="Выберите раздел",
    )


def back_keyboard() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=BACK_BUTTON)]],
        resize_keyboard=True,
        input_field_placeholder="Можно вернуться в меню",
    )
