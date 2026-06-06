import logging

from aiogram import Bot, F, Router
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message
from aiogram.exceptions import TelegramAPIError

from .config import Settings
from .keyboards import (
    BACK_BUTTON,
    CONTACT_BUTTON,
    COURSES_BUTTON,
    FAQ_BUTTON,
    PRICES_BUTTON,
    PROCESS_BUTTON,
    TRIAL_BUTTON,
    back_keyboard,
    main_menu_keyboard,
)
from .states import TrialLessonForm
from .texts import (
    CONTACT_TEXT,
    COURSES_TEXT,
    FAQ_TEXT,
    MENU_TEXT,
    PRICES_TEXT,
    PROCESS_TEXT,
    START_TEXT,
    THANK_YOU_TEXT,
)

router = Router()
logger = logging.getLogger(__name__)


def build_admin_request_text(data: dict, message: Message) -> str:
    user = message.from_user
    username = f"@{user.username}" if user and user.username else "не указан"
    user_id = user.id if user else "не указан"

    return f"""Новая заявка в Ламарум 🦙

Имя: {data.get("name", "не указано")}
Класс: {data.get("grade", "не указано")}
Сложности: {data.get("difficulties", "не указано")}
Контакт: {data.get("contact", "не указано")}
Username пользователя: {username}
ID пользователя: {user_id}"""


@router.message(CommandStart())
async def start_handler(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer(START_TEXT, reply_markup=main_menu_keyboard())


@router.message(F.text == BACK_BUTTON)
async def back_to_menu_handler(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer(MENU_TEXT, reply_markup=main_menu_keyboard())


@router.message(F.text == COURSES_BUTTON)
async def courses_handler(message: Message) -> None:
    await message.answer(COURSES_TEXT, reply_markup=back_keyboard())


@router.message(F.text == PROCESS_BUTTON)
async def process_handler(message: Message) -> None:
    await message.answer(PROCESS_TEXT, reply_markup=back_keyboard())


@router.message(F.text == PRICES_BUTTON)
async def prices_handler(message: Message) -> None:
    await message.answer(PRICES_TEXT, reply_markup=back_keyboard())


@router.message(F.text == FAQ_BUTTON)
async def faq_handler(message: Message) -> None:
    await message.answer(FAQ_TEXT, reply_markup=back_keyboard())


@router.message(F.text == CONTACT_BUTTON)
async def contact_handler(message: Message) -> None:
    await message.answer(CONTACT_TEXT, reply_markup=back_keyboard())


@router.message(F.text == TRIAL_BUTTON)
async def trial_lesson_handler(message: Message, state: FSMContext) -> None:
    await state.set_state(TrialLessonForm.name)
    await message.answer("Как вас зовут?", reply_markup=back_keyboard())


@router.message(TrialLessonForm.name)
async def get_name_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(name=message.text)
    await state.set_state(TrialLessonForm.grade)
    await message.answer("В каком классе ученик?", reply_markup=back_keyboard())


@router.message(TrialLessonForm.grade)
async def get_grade_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(grade=message.text)
    await state.set_state(TrialLessonForm.difficulties)
    await message.answer("Что сейчас сложнее всего в информатике?", reply_markup=back_keyboard())


@router.message(TrialLessonForm.difficulties)
async def get_difficulties_handler(message: Message, state: FSMContext) -> None:
    await state.update_data(difficulties=message.text)
    await state.set_state(TrialLessonForm.contact)
    await message.answer("Оставьте телефон или Telegram для связи.", reply_markup=back_keyboard())


@router.message(TrialLessonForm.contact)
async def get_contact_handler(
    message: Message,
    state: FSMContext,
    settings: Settings,
    bot: Bot,
) -> None:
    await state.update_data(contact=message.text)
    data = await state.get_data()
    await state.clear()

    try:
        await bot.send_message(settings.admin_id, build_admin_request_text(data, message))
    except TelegramAPIError:
        logger.exception("Failed to send trial lesson request to admin")

    await message.answer(THANK_YOU_TEXT, reply_markup=main_menu_keyboard())


@router.message()
async def fallback_handler(message: Message) -> None:
    await message.answer(
        "Выберите действие в меню или нажмите /start, чтобы начать заново.",
        reply_markup=main_menu_keyboard(),
    )
