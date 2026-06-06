import asyncio
import logging

from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage

from lamarum_bot.config import load_settings
from lamarum_bot.handlers import router


async def main() -> None:
    logging.basicConfig(level=logging.INFO)

    settings = load_settings()
    bot = Bot(token=settings.bot_token)
    dispatcher = Dispatcher(storage=MemoryStorage(), settings=settings)
    dispatcher.include_router(router)

    await dispatcher.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
