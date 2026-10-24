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
const INNER_SPACING_PX = 4; // gap between the date and the clock
const OUTER_TRIM_PX = 4; // how much to pull in the date's far side (never below zero spacing)

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

function px(value: string | undefined): number {
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) ? n : 0;
}

/**
 * Margin for the date's far side (the side away from the clock). Our inline margin
 * replaces whatever margin the copied class has, so start from the clock's own margin
 * and subtract a trim, capped by the spacing that side actually has (clock margin +
 * padding + the header's flex gap) so the date never gets pushed into its neighbour.
 */
function outerMargin(timeEl: HTMLElement, left: boolean): string {
  const win = timeEl.ownerDocument.defaultView;
  if (!win) return "";
  const cs = win.getComputedStyle(timeEl);
  const parentCs = timeEl.parentElement ? win.getComputedStyle(timeEl.parentElement) : null;

  const margin = px(left ? cs.marginLeft : cs.marginRight);
  const padding = px(left ? cs.paddingLeft : cs.paddingRight);
  const gap = px(parentCs?.columnGap);
  const trim = Math.min(OUTER_TRIM_PX, Math.max(0, margin + padding + gap));
  return `${margin - trim}px`;
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

  const outer = outerMargin(timeEl, left);
  dateEl.style.marginLeft = left ? outer : `${INNER_SPACING_PX}px`;
  dateEl.style.marginRight = left ? `${INNER_SPACING_PX}px` : outer;
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
