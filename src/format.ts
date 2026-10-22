export type Placement = "left" | "right";
export type DateOrder = "month-day" | "day-month";
export type YearFormat = "four" | "two";

export interface Settings {
  placement: Placement;
  order: DateOrder;
  showYear: boolean;
  yearFormat: YearFormat;
  monthName: boolean;
  padZero: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  placement: "left",
  order: "month-day",
  showYear: true,
  yearFormat: "four",
  monthName: false,
  padZero: false,
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Numeric:  11/15/2026, 15/11/2026, 11/15/26, 11/15 ...
 * Named:    Nov. 15, 2026 (month first) / 15 Nov. 2026 (day first) ...
 *           Every abbreviation ends in a period except May.
 * Zero-padding (off by default) pads the day and numeric month: 05/09/2026.
 */
export function formatDate(date: Date, s: Settings): string {
  const pad = (n: number) => (s.padZero ? String(n).padStart(2, "0") : String(n));
  const day = pad(date.getDate());
  const fullYear = date.getFullYear();
  const year =
    s.yearFormat === "two" ? String(fullYear % 100).padStart(2, "0") : String(fullYear);

  if (s.monthName) {
    const abbr = MONTHS[date.getMonth()];
    const month = abbr === "May" ? abbr : `${abbr}.`;
    if (s.order === "month-day") {
      const md = `${month} ${day}`;
      return s.showYear ? `${md}, ${year}` : md;
    }
    const dm = `${day} ${month}`;
    return s.showYear ? `${dm} ${year}` : dm;
  }

  const month = pad(date.getMonth() + 1);
  const parts = s.order === "month-day" ? [month, day] : [day, month];
  if (s.showYear) parts.push(year);
  return parts.join("/");
}
