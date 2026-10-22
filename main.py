import json
import os

import decky

DEFAULTS = {
    "placement": "left",       # "left" | "right" of the time
    "order": "month-day",      # "month-day" | "day-month"
    "showYear": True,
    "yearFormat": "four",      # "four" | "two"
    "monthName": False,        # True -> "Nov." instead of "11"
    "padZero": False,          # True -> "05/09" instead of "5/9"
}

ALLOWED = {
    "placement": {"left", "right"},
    "order": {"month-day", "day-month"},
    "yearFormat": {"four", "two"},
}
BOOLEANS = {"showYear", "monthName", "padZero"}


def _clean(raw) -> dict:
    """Keep only known keys with valid values; fill the rest from DEFAULTS."""
    out = dict(DEFAULTS)
    if not isinstance(raw, dict):
        return out
    for key, allowed in ALLOWED.items():
        if raw.get(key) in allowed:
            out[key] = raw[key]
    for key in BOOLEANS:
        if isinstance(raw.get(key), bool):
            out[key] = raw[key]
    return out


class Plugin:
    settings_path: str = ""

    async def _main(self):
        self.settings_path = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")
        decky.logger.info("DateDeck loaded")

    async def _unload(self):
        decky.logger.info("DateDeck unloaded")

    async def get_settings(self) -> dict:
        try:
            with open(self.settings_path, "r", encoding="utf-8") as f:
                return _clean(json.load(f))
        except FileNotFoundError:
            return dict(DEFAULTS)
        except Exception as e:  # corrupt file, etc.
            decky.logger.error(f"DateDeck: could not read settings: {e}")
            return dict(DEFAULTS)

    async def save_settings(self, settings: dict) -> bool:
        try:
            os.makedirs(os.path.dirname(self.settings_path), exist_ok=True)
            tmp = self.settings_path + ".tmp"
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(_clean(settings), f, indent=2)
            os.replace(tmp, self.settings_path)
            return True
        except Exception as e:
            decky.logger.error(f"DateDeck: could not save settings: {e}")
            return False
