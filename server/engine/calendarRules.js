import { toDateStr, getWeekdayName, isHoliday } from './utils.js';

/**
 * Evaluates whether a specific process is scheduled to operate on a given date.
 * Pure deterministic function with zero side effects.
 *
 * @param {Object} process - Process object with calendarRule
 * @param {Date|string} date - Date to evaluate
 * @param {Array} holidays - List of holiday objects { date, name } or date strings
 * @returns {boolean} True if the process requires staffing on this date
 */
export function processWorksOnDate(process, date, holidays = []) {
  if (!process || !process.calendarRule) return false;

  const dateStr = toDateStr(date);
  const weekday = getWeekdayName(dateStr);
  const isPublicHoliday = isHoliday(dateStr, holidays);
  const rule = process.calendarRule;
  const ruleType = typeof rule === 'string' ? rule : rule.type;

  switch (ruleType) {
    case 'ALL_365':
      // Operates every single day without exception
      return true;

    case 'ALL_EXCEPT_HOLIDAYS':
      // Operates all days except declared public holidays
      return !isPublicHoliday;

    case 'MON_SAT': {
      // Operates Monday through Saturday, skips Sunday and public holidays
      const isMonToSat = weekday !== 'Sunday';
      return isMonToSat && !isPublicHoliday;
    }

    case 'MON_FRI': {
      // Operates Monday through Friday, skips Sat/Sun and public holidays
      const isMonToFri = weekday !== 'Saturday' && weekday !== 'Sunday';
      return isMonToFri && !isPublicHoliday;
    }

    case 'CUSTOM': {
      // Custom schedule: check specified weekdays and holiday policy
      const allowedWeekdays = rule.weekdays || [];
      const isConfiguredDay = allowedWeekdays.includes(weekday);

      if (!isConfiguredDay) return false;

      // If it falls on a holiday, check holidayPolicy
      if (isPublicHoliday) {
        return rule.holidayPolicy === 'WORK';
      }

      return true;
    }

    default:
      // Default fallback: Mon-Fri except holidays
      return weekday !== 'Saturday' && weekday !== 'Sunday' && !isPublicHoliday;
  }
}

/**
 * Returns all processes that are active and required to operate on a specific date.
 *
 * @param {Array} processes - List of all processes
 * @param {Date|string} date - Date to evaluate
 * @param {Array} holidays - List of holidays
 * @returns {Array} Sub-array of processes required on that date
 */
export function requiredProcessesOnDate(processes = [], date, holidays = []) {
  return processes.filter((proc) => processWorksOnDate(proc, date, holidays));
}

/**
 * Computes the minimum staff required for a process on a given date,
 * checking for weekday overrides if present in minStaffByWeekday.
 *
 * @param {Object} process - Process object
 * @param {Date|string} date - Date to evaluate
 * @returns {number} Minimum staff count needed
 */
export function getMinStaffRequired(process, date) {
  if (!process) return 0;
  const weekday = getWeekdayName(date);

  // Check weekday override
  if (process.minStaffByWeekday) {
    // If it's a Map or plain object
    const override =
      typeof process.minStaffByWeekday.get === 'function'
        ? process.minStaffByWeekday.get(weekday)
        : process.minStaffByWeekday[weekday];

    if (override !== undefined && override !== null && override !== '') {
      return Number(override);
    }
  }

  return process.minStaffDefault !== undefined ? process.minStaffDefault : 1;
}

