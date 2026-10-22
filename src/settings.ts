import { callable } from "@decky/api";
import { DEFAULT_SETTINGS, Settings } from "./format";

const getSettingsBackend = callable<[], Partial<Settings>>("get_settings");
const saveSettingsBackend = callable<[settings: Settings], boolean>("save_settings");

type Listener = (settings: Settings) => void;

let current: Settings = { ...DEFAULT_SETTINGS };
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn(current));
}

export function getSettings(): Settings {
  return current;
}

export async function loadSettings(): Promise<void> {
  try {
    current = { ...DEFAULT_SETTINGS, ...(await getSettingsBackend()) };
  } catch (e) {
    console.error("[DateDeck] failed to load settings, using defaults", e);
  }
  notify();
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  notify();
  saveSettingsBackend(current).catch((e) =>
    console.error("[DateDeck] failed to save settings", e),
  );
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
