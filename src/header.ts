import { Router } from "@decky/ui";
import { formatDate } from "./format";
import { getSettings, subscribe } from "./settings";

/**
 * Finds the clock in the Steam UI header and inserts a date element next to it.
 *
 * Steam's CSS class names are hashed and change between client updates, so the
 * clock is located by its content (a leaf element whose text looks like a time)
 * near the top of the screen, instead of by class name. The date element copies
 * the clock's class list so it picks up the same font styling.
 */

const MARK_ATTR = "data-datedeck";
const TIME_RE = /^\s*\d{1,2}:\d{2}(\s?[AaPp]\.?[Mm]\.?)?\s*$/;
const HEADER_MAX_TOP_PX = 120; // clock must sit within this distance of the top
const RESCAN_THROTTLE_MS = 2000; // how often to search again while the clock is missing
const TICK_MS = 1000;
const SPACING_PX = 8;

interface DocState {
  timeEl: HTMLElement;
  dateEl: HTMLElement;
  observer: MutationObserver | null;
}

const states = new Map<Document, DocState>();
const lastScan = new Map<Document, number>();
let interval: number | undefined;
let unsubscribe: (() => void) | null = null;
let pending = false;

/** Documents that may contain the header (the main gamepad UI window). */
function getUiDocuments(): Document[] {
  const docs: Document[] = [];
  const add = (win: unknown) => {
    const doc = (win as Window | undefined)?.document;
    if (doc && doc.body && !docs.includes(doc)) docs.push(doc);
  };

  try {
    const store = (Router as any).WindowStore;
    add(store?.GamepadUIMainWindowInstance?.BrowserWindow);
  } catch (e) {
    /* fall through to other lookups */
  }
  try {
    const store = (window as any).SteamUIStore?.m_WindowStore;
    add(store?.GamepadUIMainWindowInstance?.BrowserWindow);
  } catch (e) {
    /* fall through */
  }
  return docs;
}

function findTimeElement(doc: Document): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestRight = -Infinity;

  for (const el of Array.from(doc.body.querySelectorAll<HTMLElement>("div, span"))) {
    if (el.hasAttribute(MARK_ATTR) || el.childElementCount > 0) continue;
    const text = el.textContent;
    if (!text || text.length > 12 || !TIME_RE.test(text)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || rect.top > HEADER_MAX_TOP_PX) continue;
    if (rect.right > bestRight) {
      best = el;
      bestRight = rect.right;
    }
  }
  return best;
}

function attach(doc: Document, timeEl: HTMLElement): DocState {
  const dateEl = doc.createElement(timeEl.tagName.toLowerCase());
  dateEl.className = timeEl.className;
  dateEl.setAttribute(MARK_ATTR, "");
  dateEl.style.whiteSpace = "nowrap";
  dateEl.style.flex = "none";

  let observer: MutationObserver | null = null;
  const parent = timeEl.parentElement;
  if (parent) {
    // Re-run if something adds/removes siblings (e.g. React re-rendering the header).
    observer = new MutationObserver(() => schedule());
    observer.observe(parent, { childList: true });
  }

  console.log("[DateDeck] attached next to clock, class =", timeEl.className);
  return { timeEl, dateEl, observer };
}

function detach(state: DocState) {
  state.observer?.disconnect();
  state.dateEl.remove();
}

function place(state: DocState) {
  const settings = getSettings();
  const { timeEl, dateEl } = state;

  const text = formatDate(new Date(), settings);
  if (dateEl.textContent !== text) dateEl.textContent = text;

  const left = settings.placement === "left";
  const inPlace = left
    ? timeEl.previousElementSibling === dateEl
    : timeEl.nextElementSibling === dateEl;
  if (!inPlace) {
    if (left) timeEl.before(dateEl);
    else timeEl.after(dateEl);
  }

  dateEl.style.marginLeft = left ? "" : `${SPACING_PX}px`;
  dateEl.style.marginRight = left ? `${SPACING_PX}px` : "";
}

function syncDocument(doc: Document) {
  let state = states.get(doc);

  if (state && !state.timeEl.isConnected) {
    detach(state);
    states.delete(doc);
    state = undefined;
  }

  if (!state) {
    const now = Date.now();
    if (now - (lastScan.get(doc) ?? 0) < RESCAN_THROTTLE_MS) return;
    lastScan.set(doc, now);

    const timeEl = findTimeElement(doc);
    if (!timeEl) return;
    state = attach(doc, timeEl);
    states.set(doc, state);
  }

  place(state);
}

function tick() {
  try {
    const docs = getUiDocuments();
    for (const [doc, state] of Array.from(states)) {
      if (!docs.includes(doc)) {
        detach(state);
        states.delete(doc);
      }
    }
    docs.forEach(syncDocument);
  } catch (e) {
    console.error("[DateDeck] tick failed", e);
  }
}

function schedule() {
  if (pending) return;
  pending = true;
  setTimeout(() => {
    pending = false;
    tick();
  }, 0);
}

export function startHeader() {
  if (interval !== undefined) return;
  unsubscribe = subscribe(() => tick());
  tick();
  interval = window.setInterval(tick, TICK_MS);
}

export function stopHeader() {
  if (interval !== undefined) {
    window.clearInterval(interval);
    interval = undefined;
  }
  unsubscribe?.();
  unsubscribe = null;
  states.forEach(detach);
  states.clear();
  lastScan.clear();
}
