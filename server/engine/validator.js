import { toDateStr, getWeekdayName, getMonthDates, groupDatesIntoWeeks } from './utils.js';
import { processWorksOnDate, getMinStaffRequired } from './calendarRules.js';
import { getApprovedLeaveForDate } from './availability.js';

/**
 * Validates a roster (generated or manually updated) against all hard and soft constraints.
 * Pure deterministic function with zero DB calls. Returns instantly (< 50ms).
 *
 * @param {Object} context
 * @param {Array} context.employees - Array of employee objects
 * @param {Array} context.brands - Array of brand objects
 * @param {Array} context.processes - Array of process objects
 * @param {Array} context.assignments - Array of assignment objects
 * @param {Array} context.holidays - Array of holidays
 * @param {Array} context.leaves - Array of leaves
 * @param {Array} context.entries - Array of RosterEntry objects
 * @param {number} context.year - Year
 * @param {number} context.month - Month (1-12)
 * @returns {Array<Object>} List of structured Conflict objects
 */
export function validate(context) {
  const {
    employees = [],
    brands = [],
    processes = [],
    assignments = [],
    holidays = [],
    leaves = [],
    entries = [],
    year,
    month,
  } = context;

  const conflicts = [];
  const monthDates = getMonthDates(year, month);
  const weeks = groupDatesIntoWeeks(monthDates);

  // Fast Lookup Maps
  const empMap = new Map(employees.map((e) => [(e._id || e).toString(), e]));
  const brandMap = new Map(brands.map((b) => [(b._id || b).toString(), b]));
  const procMap = new Map(processes.map((p) => [(p._id || p).toString(), p]));

  // Index entries by `empId:dateStr` -> status (and source)
  const entryLookup = new Map();
  const entrySourceLookup = new Map();
  for (const entry of entries) {
    const eEmpId = (entry.employeeId?._id || entry.employeeId).toString();
    const eDateStr = toDateStr(entry.date);
    const key = `${eEmpId}:${eDateStr}`;
    entryLookup.set(key, entry.status);
    entrySourceLookup.set(key, entry.source || 'AUTO');
  }

  // Pre-calculate assignments per process, primary assignments per employee, and primary staff per brand
  const procAssignments = new Map();
  const empPrimaryAssignments = new Map();
  const brandPrimaryStaffMap = new Map();

  for (const a of assignments) {
    const pId = (a.processId?._id || a.processId).toString();
    const eId = (a.employeeId?._id || a.employeeId).toString();
    if (!procAssignments.has(pId)) procAssignments.set(pId, []);
    procAssignments.get(pId).push(a);

    if (a.role === 'primary') {
      if (!empPrimaryAssignments.has(eId)) empPrimaryAssignments.set(eId, []);
      empPrimaryAssignments.get(eId).push(a);
    }

    const proc = procMap.get(pId);
    if (proc) {
      const bId = (proc.brandId?._id || proc.brandId).toString();
      if (!brandPrimaryStaffMap.has(bId)) brandPrimaryStaffMap.set(bId, new Set());
      if (a.role !== 'backup') {
        brandPrimaryStaffMap.get(bId).add(eId);
      }
    }
  }

  // Precompute weekday names and process operating days across monthDates
  const weekdayMap = new Map(monthDates.map((d) => [d, getWeekdayName(d)]));
  const procWorksSet = new Set();
  for (const process of processes) {
    const pId = (process._id || process).toString();
    for (const dateStr of monthDates) {
      if (processWorksOnDate(process, dateStr, holidays)) {
        procWorksSet.add(`${pId}:${dateStr}`);
      }
    }
  }

  // =========================================================================
  // 1. HARD CONSTRAINTS: Process Coverage, Understaffing, and SPOF per Date
  // =========================================================================
  for (const dateStr of monthDates) {
    for (const process of processes) {
      const pId = (process._id || process).toString();
      const bId = (process.brandId?._id || process.brandId).toString();
      const brand = brandMap.get(bId);
      if (brand && brand.active === false) continue;
      const brandName = brand ? brand.name : 'Unknown Brand';

      // Check if process operates on this date
      const worksToday = procWorksSet.has(`${pId}:${dateStr}`);
      if (!worksToday) continue;

      const minStaff = getMinStaffRequired(process, dateStr);
      const assignList = procAssignments.get(pId) || [];

      // Check: No assigned employees at all (Understaffed brand/process)
      if (assignList.length === 0) {
        conflicts.push({
          severity: 'ERROR',
          type: 'UNDERSTAFFED_BRAND',
          date: dateStr,
          brandId: bId,
          processId: pId,
          employeeIds: [],
          message: `Brand "${brandName}" has no employees assigned to process ${process.type} which operates on ${dateStr}.`,
          suggestions: [`Assign at least ${minStaff} employee(s) to ${process.type} for brand "${brandName}".`],
        });
        continue;
      }

      // Check: How many assigned employees are actively WORKING on this date?
      const availableAssignedEmps = [];
      const unavailableAssignedEmps = [];

      for (const a of assignList) {
        const eId = (a.employeeId?._id || a.employeeId).toString();
        const emp = empMap.get(eId);
        if (!emp || emp.active === false) continue;

        const key = `${eId}:${dateStr}`;
        const status = entryLookup.get(key);
        const source = entrySourceLookup.get(key);
        const hasPendingLeaveSync =
          status === 'WORKING' &&
          source !== 'MANUAL' &&
          Boolean(getApprovedLeaveForDate(eId, leaves, dateStr));

        if (status === 'WORKING' && !hasPendingLeaveSync) {
          availableAssignedEmps.push(eId);
        } else {
          unavailableAssignedEmps.push(eId);
        }
      }

      // Detect COVERAGE_GAP
      if (availableAssignedEmps.length < minStaff) {
        // Check if single point of failure (SPOF)
        const brandPrimaryStaff = brandPrimaryStaffMap.get(bId) || new Set();
        const isSPOF = brandPrimaryStaff.size === 1;

        if (isSPOF) {
          conflicts.push({
            severity: 'ERROR',
            type: 'SPOF_RISK',
            date: dateStr,
            brandId: bId,
            processId: pId,
            employeeIds: unavailableAssignedEmps,
            message: `Single Point of Failure: Brand "${brandName}" relies entirely on 1 employee who is unavailable on ${dateStr}. Process ${process.type} is unstaffed.`,
            suggestions: [
              `Assign a backup employee from the same pod.`,
              `Change employee weekly-off or reassign shift.`,
            ],
          });
        }

        conflicts.push({
          severity: 'ERROR',
          type: 'COVERAGE_GAP',
          date: dateStr,
          brandId: bId,
          processId: pId,
          employeeIds: unavailableAssignedEmps,
          message: `Coverage Gap: Brand "${brandName}" (${process.type}) requires ${minStaff} staff on ${dateStr}, but only ${availableAssignedEmps.length} active.`,
          suggestions: [
            `Assign a cross-trained backup employee for ${dateStr}.`,
            `Swap off-days with another employee.`,
          ],
        });
      }
    }

    // Check: DOUBLE_BOOKING (overlapping 100% allocation across active brands)
    for (const employee of employees) {
      const eId = (employee._id || employee).toString();
      const status = entryLookup.get(`${eId}:${dateStr}`);
      if (status !== 'WORKING') continue;

      // Find all primary processes working today that this employee is assigned to
      const empWorkingProcs = [];
      const myPrimaryAssigns = empPrimaryAssignments.get(eId) || [];
      for (const assign of myPrimaryAssigns) {
        const pId = (assign.processId?._id || assign.processId).toString();
        if (!procWorksSet.has(`${pId}:${dateStr}`)) continue;
        const process = procMap.get(pId);
        if (process) {
          empWorkingProcs.push({ process, assign });
        }
      }

      const totalAllocation = empWorkingProcs.reduce((sum, item) => sum + (item.assign.allocationPercent || 100), 0);
      if (totalAllocation > 100 && empWorkingProcs.length > 1) {
        conflicts.push({
          severity: 'ERROR',
          type: 'DOUBLE_BOOKING',
          date: dateStr,
          brandId: null,
          processId: null,
          employeeIds: [eId],
          message: `Double Booking: ${employee.name} is allocated ${totalAllocation}% across multiple operating processes on ${dateStr}.`,
          suggestions: [`Adjust allocation percentages or assign secondary backup.`],
        });
      }
    }
  }

  // =========================================================================
  // 2. SOFT CONSTRAINTS: Weekly Off Count, Max Consecutive Days, Preferences
  // =========================================================================
  for (const employee of employees) {
    const eId = (employee._id || employee).toString();
    const maxConsecutive = employee.maxConsecutiveWorkDays || 6;
    const preferences = employee.weeklyOffPreference || ['Sunday'];

    // Check Weekly Off count per week
    for (let wIdx = 0; wIdx < weeks.length; wIdx++) {
      const weekDates = weeks[wIdx];
      // Only enforce for full or mostly full weeks (>= 4 days)
      if (weekDates.length < 4) continue;

      let weeklyOffCount = 0;
      let nonPreferredOffDates = [];

      for (const dStr of weekDates) {
        const status = entryLookup.get(`${eId}:${dStr}`);
        if (status === 'WEEKLY_OFF') {
          weeklyOffCount++;
          const dayName = weekdayMap.get(dStr);
          if (!preferences.includes(dayName)) {
            nonPreferredOffDates.push({ date: dStr, dayName });
          }
        }
      }

      if (weeklyOffCount === 0) {
        conflicts.push({
          severity: 'WARNING',
          type: 'NO_WEEKLY_OFF',
          date: weekDates[0],
          brandId: null,
          processId: null,
          employeeIds: [eId],
          message: `Workload Alert: ${employee.name} has no weekly off scheduled in week ${wIdx + 1} (${weekDates[0]} to ${weekDates[weekDates.length - 1]}).`,
          suggestions: [`Grant a weekly off on ${preferences.join(' or ')} if coverage permits.`],
        });
      }

      // Check soft preference violation
      for (const np of nonPreferredOffDates) {
        conflicts.push({
          severity: 'WARNING',
          type: 'PREFERENCE_VIOLATION',
          date: np.date,
          brandId: null,
          processId: null,
          employeeIds: [eId],
          message: `Preference Note: ${employee.name} has weekly off on ${np.dayName} (${np.date}), but prefers ${preferences.join(', ')}.`,
          suggestions: [`Consider swapping with an employee who prefers ${np.dayName}.`],
        });
      }
    }

    // Check Max Consecutive Working Days across the month
    let consecutiveCount = 0;
    let consecutiveStart = null;

    for (const dStr of monthDates) {
      const status = entryLookup.get(`${eId}:${dStr}`);
      if (status === 'WORKING') {
        consecutiveCount++;
        if (!consecutiveStart) consecutiveStart = dStr;

        if (consecutiveCount > maxConsecutive) {
          conflicts.push({
            severity: 'WARNING',
            type: 'CONSECUTIVE_DAYS',
            date: dStr,
            brandId: null,
            processId: null,
            employeeIds: [eId],
            message: `Burnout Risk: ${employee.name} is scheduled to work ${consecutiveCount} consecutive days (since ${consecutiveStart}), exceeding max limit of ${maxConsecutive}.`,
            suggestions: [`Introduce a weekly off or comp-off on ${dStr}.`],
          });
        }
      } else {
        consecutiveCount = 0;
        consecutiveStart = null;
      }
    }
  }

  return conflicts;
}
