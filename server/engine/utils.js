/**
 * Pure date utility functions for the RosterIQ Scheduling Engine.
 * Operates purely on standard Date objects or ISO strings (YYYY-MM-DD).
 */

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Normalizes any Date object or string into a clean 'YYYY-MM-DD' string.
 * Uses UTC to avoid local timezone offset shifts.
 * @param {Date|string} date
 * @returns {string} 'YYYY-MM-DD'
 */
export function toDateStr(date) {
  if (!date) return '';
  if (typeof date === 'string') {
    return date.slice(0, 10);
  }
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns UTC Date object at 00:00:00.000Z for a 'YYYY-MM-DD' string or Date.
 * @param {Date|string} date
 * @returns {Date}
 */
export function toUTCDate(date) {
  const str = toDateStr(date);
  return new Date(`${str}T00:00:00.000Z`);
}

/**
 * Returns the weekday name (e.g. 'Monday') for a given date.
 * @param {Date|string} date
 * @returns {string}
 */
export function getWeekdayName(date) {
  const d = toUTCDate(date);
  return WEEKDAYS[d.getUTCDay()];
}

/**
 * Returns all dates in a month as an array of 'YYYY-MM-DD' strings.
 * @param {number} year - e.g. 2025
 * @param {number} month - 1 to 12
 * @returns {string[]}
 */
export function getMonthDates(year, month) {
  const dates = [];
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    dates.push(`${year}-${monthStr}-${dayStr}`);
  }
  return dates;
}

/**
 * Groups an array of dates into calendar weeks (each starting Sunday or Monday).
 * @param {string[]} dateStrs - array of 'YYYY-MM-DD'
 * @returns {string[][]} Array of weeks, each containing date strings
 */
export function groupDatesIntoWeeks(dateStrs) {
  const weeks = [];
  let currentWeek = [];

  for (const dateStr of dateStrs) {
    const day = getWeekdayName(dateStr);
    currentWeek.push(dateStr);
    // If Saturday, close current week
    if (day === 'Saturday') {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return weeks;
}

/**
 * Checks if a given date is in a list of holidays.
 * @param {Date|string} date
 * @param {Array<Date|string|{ date: Date|string }>} holidays
 * @returns {boolean}
 */
export function isHoliday(date, holidays = []) {
  const targetStr = toDateStr(date);
  return holidays.some((h) => {
    const hDate = h.date ? h.date : h;
    return toDateStr(hDate) === targetStr;
  });
}

