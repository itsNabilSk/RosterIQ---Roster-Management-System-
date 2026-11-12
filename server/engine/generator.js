import {
  toDateStr,
  getWeekdayName,
  getMonthDates,
  groupDatesIntoWeeks,
  isHoliday,
} from './utils.js';
import { processWorksOnDate, getMinStaffRequired } from './calendarRules.js';
import { validate } from './validator.js';

export const VALID_STRATEGIES = [
  'BALANCED',
  'FAIR_DISTRIBUTION',
  'PREFERENCE_FIRST',
  'OPERATIONS_FIRST',
];

/**
 * Computes constraint pressure metrics for an employee.
 */
function getEmployeeConstraintStats(emp, empAssignments, procMap, brandStaffMap) {
  const eId = (emp._id || emp).toString();
  const myAssigns = empAssignments.get(eId) || [];

  let singleResourceCount = 0;
  let all365Count = 0;

  for (const assign of myAssigns) {
    const proc = procMap.get((assign.processId?._id || assign.processId).toString());
    if (!proc) continue;
    const bId = (proc.brandId?._id || proc.brandId).toString();
    if ((brandStaffMap.get(bId) || new Set()).size === 1) {
      singleResourceCount++;
    }
    if (proc.calendarRule?.type === 'ALL_365') {
      all365Count++;
    }
  }

  return {
    singleResourceCount,
    all365Count,
    totalProcs: myAssigns.length,
    prefCount: (emp.weeklyOffPreference || ['Sunday']).length,
  };
}

/**
 * Checks if giving employee `eId` a WEEKLY_OFF on `targetDate` drops any assigned active process below minStaff.
 */
function wouldBreakCoverage({
  eId,
  targetDate,
  myAssignments,
  procMap,
  brandMap,
  procAssignments,
  matrix,
  procWorksSet,
  approvedLeaveMap,
}) {
  for (const assign of myAssignments) {
    const pId = (assign.processId?._id || assign.processId).toString();
    const proc = procMap.get(pId);
    if (!proc) continue;

    const bId = (proc.brandId?._id || proc.brandId).toString();
    const b = brandMap.get(bId);
    if (b && b.active === false) continue;

    if (!procWorksSet.has(`${pId}:${targetDate}`)) continue;

    const minStaff = getMinStaffRequired(proc, targetDate);
    const allAssigned = procAssignments.get(pId) || [];

    let otherAvailableCount = 0;
    for (const otherA of allAssigned) {
      const otherEId = (otherA.employeeId?._id || otherA.employeeId).toString();
      if (otherEId === eId) continue;

      const otherStatus = matrix.get(otherEId)?.get(targetDate);
      if (otherStatus === 'WEEKLY_OFF' || otherStatus === 'LEAVE' || otherStatus === 'COMP_OFF') {
        continue;
      }

      if (!approvedLeaveMap.has(`${otherEId}:${targetDate}`)) {
        otherAvailableCount++;
      }
    }

    if (otherAvailableCount < minStaff) {
      return true;
    }
  }
  return false;
}

/**
 * Counts operating processes and (optionally) minimum staffing slack for an employee on a specific date.
 */
function getDateOperationalMetrics({
  eId,
  dateStr,
  myAssignments,
  procMap,
  brandMap,
  procAssignments,
  matrix,
  procWorksSet,
  approvedLeaveMap,
  computeSlack = false,
}) {
  let activeProcs = 0;
  let minSlack = Infinity;

  for (const a of myAssignments) {
    const pId = (a.processId?._id || a.processId).toString();
    const proc = procMap.get(pId);
    if (!proc) continue;
    const bId = (proc.brandId?._id || proc.brandId).toString();
    const b = brandMap.get(bId);
    if (b && b.active === false) continue;

    if (!procWorksSet.has(`${pId}:${dateStr}`)) continue;
    activeProcs++;

    if (computeSlack) {
      const minStaff = getMinStaffRequired(proc, dateStr);
      const allAssigned = procAssignments.get(pId) || [];
      let otherAvailable = 0;
      for (const otherA of allAssigned) {
        const otherEId = (otherA.employeeId?._id || otherA.employeeId).toString();
        if (otherEId === eId) continue;
        const otherStatus = matrix.get(otherEId)?.get(dateStr);
        if (otherStatus === 'WEEKLY_OFF' || otherStatus === 'LEAVE' || otherStatus === 'COMP_OFF') {
          continue;
        }
        if (!approvedLeaveMap.has(`${otherEId}:${dateStr}`)) {
          otherAvailable++;
        }
      }
      minSlack = Math.min(minSlack, otherAvailable - minStaff);
    }
  }

  return {
    activeProcs,
    minSlack: minSlack === Infinity ? 99 : minSlack,
  };
}

/**
 * Generates a complete, constraint-aware monthly roster.
 * Pure deterministic algorithm with zero DB calls.
 * Runs in < 200ms for 32+ employees across 31 days.
 *
 * @param {Object} context
 * @param {Array} context.employees - All employee objects
 * @param {Array} context.brands - All brand objects
 * @param {Array} context.processes - All process objects
 * @param {Array} context.assignments - All assignment objects
 * @param {Array} context.holidays - Holiday objects
 * @param {Array} context.leaves - Leave objects
 * @param {number} context.year - e.g. 2025
 * @param {number} context.month - e.g. 12
 * @param {Object} [options]
 * @param {'BALANCED'|'FAIR_DISTRIBUTION'|'PREFERENCE_FIRST'|'OPERATIONS_FIRST'} [options.strategy='BALANCED']
 * @returns {{ entries: Array<Object>, conflicts: Array<Object> }}
 */
export function generateRoster(context, options = {}) {
  const {
    employees = [],
    brands = [],
    processes = [],
    assignments = [],
    holidays = [],
    leaves = [],
    year,
    month,
  } = context;

  const strategy = VALID_STRATEGIES.includes(options?.strategy)
    ? options.strategy
    : 'BALANCED';

  const monthDates = getMonthDates(year, month);
  const weeks = groupDatesIntoWeeks(monthDates);

  // Fast Lookups
  const empMap = new Map(employees.map((e) => [(e._id || e).toString(), e]));
  const brandMap = new Map(brands.map((b) => [(b._id || b).toString(), b]));
  const procMap = new Map(processes.map((p) => [(p._id || p).toString(), p]));
  const weekdayMap = new Map(monthDates.map((dStr) => [dStr, getWeekdayName(dStr)]));

  const approvedLeaveMap = new Map();
  for (const leave of leaves) {
    if (leave.status !== 'APPROVED') continue;
    const lEmpId = (leave.employeeId?._id || leave.employeeId).toString();
    const lDateStr = toDateStr(leave.date);
    approvedLeaveMap.set(`${lEmpId}:${lDateStr}`, leave);
  }

  const procWorksSet = new Set();
  for (const proc of processes) {
    const pId = (proc._id || proc).toString();
    for (const dStr of monthDates) {
      if (processWorksOnDate(proc, dStr, holidays)) {
        procWorksSet.add(`${pId}:${dStr}`);
      }
    }
  }

  // Index assignments by employeeId and processId
  const empAssignments = new Map();
  const procAssignments = new Map();
  const brandStaffMap = new Map();

  for (const a of assignments) {
    const eId = (a.employeeId?._id || a.employeeId).toString();
    const pId = (a.processId?._id || a.processId).toString();

    if (!empAssignments.has(eId)) empAssignments.set(eId, []);
    empAssignments.get(eId).push(a);

    if (!procAssignments.has(pId)) procAssignments.set(pId, []);
    procAssignments.get(pId).push(a);

    const proc = procMap.get(pId);
    if (proc) {
      const bId = (proc.brandId?._id || proc.brandId).toString();
      const b = brandMap.get(bId);
      if (b && b.active === false) continue;
      if (!brandStaffMap.has(bId)) brandStaffMap.set(bId, new Set());
      brandStaffMap.get(bId).add(eId);
    }
  }

  // Matrix: employeeId -> (dateStr -> status)
  const matrix = new Map();
  for (const emp of employees) {
    const eId = (emp._id || emp).toString();
    matrix.set(eId, new Map());
  }

  // =========================================================================
  // STEP 1: Lock Hard Constraints (Approved Leaves, Comp-Offs, Non-working Holidays)
  // =========================================================================
  for (const dateStr of monthDates) {
    const isPublicHoliday = isHoliday(dateStr, holidays);

    for (const emp of employees) {
      const eId = (emp._id || emp).toString();
      const empRow = matrix.get(eId);

      // 1. Check approved leave / comp-off
      const approvedLeave = approvedLeaveMap.get(`${eId}:${dateStr}`);
      if (approvedLeave) {
        empRow.set(dateStr, approvedLeave.type === 'COMP_OFF' ? 'COMP_OFF' : 'LEAVE');
        continue;
      }

      // 2. Check public holiday
      if (isPublicHoliday) {
        // Check if ANY process assigned to this employee operates on this holiday
        const worksOnThisHoliday = (empAssignments.get(eId) || []).some((a) => {
          const pId = (a.processId?._id || a.processId).toString();
          return procWorksSet.has(`${pId}:${dateStr}`);
        });

        if (!worksOnThisHoliday) {
          empRow.set(dateStr, 'HOLIDAY');
          continue;
        }
      }
    }
  }

  // =========================================================================
  // STEP 2: Sort Employees by Strategy & Constraint Complexity
  // =========================================================================
  const empStatsMap = new Map(
    employees.map((e) => [
      (e._id || e).toString(),
      getEmployeeConstraintStats(e, empAssignments, procMap, brandStaffMap),
    ])
  );

  const sortedEmployees = [...employees].sort((a, b) => {
    const sa = empStatsMap.get((a._id || a).toString());
    const sb = empStatsMap.get((b._id || b).toString());

    if (strategy === 'PREFERENCE_FIRST') {
      // Narrower preference lists go first so picky constraints get locked early
      if (sa.prefCount !== sb.prefCount) return sa.prefCount - sb.prefCount;
      if (sb.singleResourceCount !== sa.singleResourceCount) {
        return sb.singleResourceCount - sa.singleResourceCount;
      }
      return sb.all365Count - sa.all365Count;
    }

    if (strategy === 'OPERATIONS_FIRST') {
      // Highest process load & single-resource brands first, Pod Leads last on tie
      if (sb.singleResourceCount !== sa.singleResourceCount) {
        return sb.singleResourceCount - sa.singleResourceCount;
      }
      if (sb.totalProcs !== sa.totalProcs) {
        return sb.totalProcs - sa.totalProcs;
      }
      return sb.all365Count - sa.all365Count;
    }

    // Default BALANCED & base tier for FAIR_DISTRIBUTION: Most-Constrained-First
    if (sb.singleResourceCount !== sa.singleResourceCount) {
      return sb.singleResourceCount - sa.singleResourceCount;
    }
    return sb.all365Count - sa.all365Count;
  });

  // =========================================================================
  // STEP 3: Greedy Weekly-Off Placement (Strategy-Aware)
  // =========================================================================
  const dailyOffCounts = new Map(); // dateStr -> count of WEEKLY_OFF placed so far
  const empWeekendOffCounts = new Map(); // eId -> count of Sat/Sun WEEKLY_OFFs

  const tryPlaceWeeklyOffForEmpWeek = (emp, weekDates) => {
    const eId = (emp._id || emp).toString();
    const empRow = matrix.get(eId);
    const preferences = emp.weeklyOffPreference || ['Sunday'];
    const myAssignments = empAssignments.get(eId) || [];

    const existingWeeklyOffs = weekDates.filter((dStr) => empRow.get(dStr) === 'WEEKLY_OFF');
    if (existingWeeklyOffs.length >= 1) return;

    const opMetrics = new Map(
      weekDates.map((dStr) => [
        dStr,
        getDateOperationalMetrics({
          eId,
          dateStr: dStr,
          myAssignments,
          procMap,
          brandMap,
          procAssignments,
          matrix,
          procWorksSet,
          approvedLeaveMap,
          computeSlack: strategy === 'OPERATIONS_FIRST',
        }),
      ])
    );

    const candidateDays = [...weekDates].sort((d1, d2) => {
      const day1 = weekdayMap.get(d1);
      const day2 = weekdayMap.get(d2);
      const prefIdx1 = preferences.indexOf(day1);
      const prefIdx2 = preferences.indexOf(day2);
      const d1Pref = prefIdx1 !== -1;
      const d2Pref = prefIdx2 !== -1;
      const m1 = opMetrics.get(d1);
      const m2 = opMetrics.get(d2);

      if (strategy === 'FAIR_DISTRIBUTION') {
        // Balance company-wide daily off density first so staffing stays smooth across the week,
        // while rotating weekend-off fairness and respecting preferred weekdays as tiebreaker.
        const load1 = dailyOffCounts.get(d1) || 0;
        const load2 = dailyOffCounts.get(d2) || 0;
        const isWknd1 = day1 === 'Saturday' || day1 === 'Sunday';
        const isWknd2 = day2 === 'Saturday' || day2 === 'Sunday';
        const gotWknd = empWeekendOffCounts.get(eId) || 0;

        // Weighted score: lower is better
        const score1 =
          m1.activeProcs * 1.5 +
          load1 * 1.0 +
          (d1Pref ? -0.8 : 0.4) +
          (gotWknd === 0 && isWknd1 ? -0.5 : 0);
        const score2 =
          m2.activeProcs * 1.5 +
          load2 * 1.0 +
          (d2Pref ? -0.8 : 0.4) +
          (gotWknd === 0 && isWknd2 ? -0.5 : 0);

        if (score1 !== score2) return score1 - score2;
        return m2.minSlack - m1.minSlack;
      }

      if (strategy === 'PREFERENCE_FIRST') {
        if (d1Pref && !d2Pref) return -1;
        if (!d1Pref && d2Pref) return 1;
        if (d1Pref && d2Pref && prefIdx1 !== prefIdx2) return prefIdx1 - prefIdx2;
        return m1.activeProcs - m2.activeProcs;
      }

      if (strategy === 'OPERATIONS_FIRST') {
        if (m1.activeProcs !== m2.activeProcs) return m1.activeProcs - m2.activeProcs;
        if (m2.minSlack !== m1.minSlack) return m2.minSlack - m1.minSlack;
        if (d1Pref && !d2Pref) return -1;
        if (!d1Pref && d2Pref) return 1;
        return 0;
      }

      // Default BALANCED strategy (preserves exact baseline behavior)
      if (d1Pref && !d2Pref) return -1;
      if (!d1Pref && d2Pref) return 1;
      return m1.activeProcs - m2.activeProcs;
    });

    for (const targetDate of candidateDays) {
      if (empRow.has(targetDate)) continue;

      const breaksCoverage = wouldBreakCoverage({
        eId,
        targetDate,
        myAssignments,
        procMap,
        brandMap,
        procAssignments,
        matrix,
        procWorksSet,
        approvedLeaveMap,
      });

      if (!breaksCoverage) {
        empRow.set(targetDate, 'WEEKLY_OFF');
        dailyOffCounts.set(targetDate, (dailyOffCounts.get(targetDate) || 0) + 1);
        const dayName = weekdayMap.get(targetDate);
        if (dayName === 'Saturday' || dayName === 'Sunday') {
          empWeekendOffCounts.set(eId, (empWeekendOffCounts.get(eId) || 0) + 1);
        }
        break;
      }
    }
  };

  if (strategy === 'FAIR_DISTRIBUTION') {
    // Process week-by-week and rotate non-single-resource staff order across weeks
    // so no employee is perpetually stuck with leftover off-days every week.
    const constrainedTier = sortedEmployees.filter(
      (e) => empStatsMap.get((e._id || e).toString()).singleResourceCount > 0
    );
    const sharedTier = sortedEmployees.filter(
      (e) => empStatsMap.get((e._id || e).toString()).singleResourceCount === 0
    );

    for (let weekIdx = 0; weekIdx < weeks.length; weekIdx++) {
      const weekDates = weeks[weekIdx];
      const rotatedShared =
        sharedTier.length > 0
          ? sharedTier.map((_, idx) => sharedTier[(idx + weekIdx) % sharedTier.length])
          : [];
      for (const emp of [...constrainedTier, ...rotatedShared]) {
        tryPlaceWeeklyOffForEmpWeek(emp, weekDates);
      }
    }
  } else {
    for (const emp of sortedEmployees) {
      for (const weekDates of weeks) {
        tryPlaceWeeklyOffForEmpWeek(emp, weekDates);
      }
    }
  }

  // =========================================================================
  // STEP 4: Fill All Remaining Cells as WORKING
  // =========================================================================
  for (const emp of employees) {
    const eId = (emp._id || emp).toString();
    const empRow = matrix.get(eId);

    for (const dateStr of monthDates) {
      if (!empRow.has(dateStr)) {
        empRow.set(dateStr, 'WORKING');
      }
    }
  }

  // =========================================================================
  // STEP 5: Format Entries Array
  // =========================================================================
  const entries = [];
  for (const emp of employees) {
    const eId = (emp._id || emp).toString();
    const empRow = matrix.get(eId);

    for (const dateStr of monthDates) {
      entries.push({
        employeeId: emp._id || emp,
        date: dateStr,
        status: empRow.get(dateStr) || 'WORKING',
        source: 'AUTO',
      });
    }
  }

  // =========================================================================
  // STEP 6: Run Validator to Detect All Conflicts
  // =========================================================================
  const conflicts = validate({
    employees,
    brands,
    processes,
    assignments,
    holidays,
    leaves,
    entries,
    year,
    month,
  });

  return {
    entries,
    conflicts,
  };
}

