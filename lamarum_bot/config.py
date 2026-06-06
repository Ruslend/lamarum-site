from dataclasses import dataclass
from os import environ
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    bot_token: str
    admin_id: int


def load_settings() -> Settings:
    load_env_file(Path(".env"))

    bot_token = environ.get("BOT_TOKEN")
    admin_id_raw = environ.get("ADMIN_ID")

    if not bot_token:
        raise RuntimeError("BOT_TOKEN is missing. Add it to .env.")

    if not admin_id_raw:
        raise RuntimeError("ADMIN_ID is missing. Add it to .env.")

    try:
        admin_id = int(admin_id_raw)
    except ValueError as exc:
        raise RuntimeError("ADMIN_ID must be a numeric Telegram user ID.") from exc

    return Settings(bot_token=bot_token, admin_id=admin_id)


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key and key not in environ:
            environ[key] = value
