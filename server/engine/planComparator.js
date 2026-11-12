import { generateRoster, VALID_STRATEGIES } from './generator.js';
import { getMonthDates, getWeekdayName, toDateStr } from './utils.js';
import { processWorksOnDate, getMinStaffRequired } from './calendarRules.js';

export const STRATEGY_META = {
  BALANCED: {
    id: 'BALANCED',
    label: 'Balanced (Constraint-First)',
    shortLabel: 'Balanced',
    description:
      'Default planner. Protects single-resource brands first, honors preferred weekly offs when safe, and avoids coverage drops.',
  },
  FAIR_DISTRIBUTION: {
    id: 'FAIR_DISTRIBUTION',
    label: 'Fair Off-Day Distribution',
    shortLabel: 'Fair Distribution',
    description:
      'Rotates priority across weeks and spreads weekly offs evenly across days so staffing stays smooth and weekend offs are shared fairly.',
  },
  PREFERENCE_FIRST: {
    id: 'PREFERENCE_FIRST',
    label: 'Employee Preference-First',
    shortLabel: 'Preference-First',
    description:
      'Prioritizes strict employee off-day preferences first while still blocking any off-day that would violate minimum staffing.',
  },
  OPERATIONS_FIRST: {
    id: 'OPERATIONS_FIRST',
    label: 'Peak Coverage-First',
    shortLabel: 'Coverage-First',
    description:
      'Places weekly offs only on days with maximum staffing slack and lowest active process demand before considering preferences.',
  },
};

/**
 * Evaluates coverage, fairness, preference match, and daily staffing balance for one generated plan.
 */
function computePlanMetrics({ entries, conflicts, context }) {
  const { employees = [], brands = [], processes = [], assignments = [], holidays = [], year, month } = context;
  const monthDates = getMonthDates(year, month);

  const empMap = new Map(employees.map((e) => [(e._id || e).toString(), e]));
  const brandMap = new Map(brands.map((b) => [(b._id || b).toString(), b]));

  // Index entries by employee and date
  const workingSet = new Set();
  const dailyWorkingMap = new Map(monthDates.map((d) => [d, 0]));
  const offDaysByEmployee = {};
  const weekendOffEmpSet = new Set();

  let workingDays = 0;
  let weeklyOffs = 0;
  let leavesCount = 0;
  let compOffs = 0;
  let holidaysCount = 0;
  let prefMatchedOffs = 0;

  for (const entry of entries) {
    const eId = (entry.employeeId?._id || entry.employeeId).toString();
    const dStr = toDateStr(entry.date);

    if (entry.status === 'WORKING') {
      workingDays++;
      workingSet.add(`${eId}:${dStr}`);
      dailyWorkingMap.set(dStr, (dailyWorkingMap.get(dStr) || 0) + 1);
    } else if (entry.status === 'WEEKLY_OFF') {
      weeklyOffs++;
      if (!offDaysByEmployee[eId]) offDaysByEmployee[eId] = [];
      offDaysByEmployee[eId].push(dStr);

      const emp = empMap.get(eId);
      const prefs = emp?.weeklyOffPreference || ['Sunday'];
      const weekday = getWeekdayName(dStr);
      if (prefs.includes(weekday)) {
        prefMatchedOffs++;
      }
      if (weekday === 'Saturday' || weekday === 'Sunday') {
        weekendOffEmpSet.add(eId);
      }
    } else if (entry.status === 'LEAVE') {
      leavesCount++;
    } else if (entry.status === 'COMP_OFF') {
      compOffs++;
    } else if (entry.status === 'HOLIDAY') {
      holidaysCount++;
    }
  }

  // Compute process-date coverage rate
  const procAssignments = new Map();
  for (const a of assignments) {
    const pId = (a.processId?._id || a.processId).toString();
    if (!procAssignments.has(pId)) procAssignments.set(pId, []);
    procAssignments.get(pId).push((a.employeeId?._id || a.employeeId).toString());
  }

  let requiredSlots = 0;
  let satisfiedSlots = 0;

  for (const proc of processes) {
    const bId = (proc.brandId?._id || proc.brandId).toString();
    const brand = brandMap.get(bId);
    if (brand && brand.active === false) continue;

    const assignedEmpIds = procAssignments.get((proc._id || proc).toString()) || [];

    for (const dStr of monthDates) {
      if (!processWorksOnDate(proc, dStr, holidays)) continue;
      const minStaff = getMinStaffRequired(proc, dStr);
      if (minStaff <= 0) continue;

      requiredSlots++;
      let count = 0;
      for (const eId of assignedEmpIds) {
        if (workingSet.has(`${eId}:${dStr}`)) count++;
      }
      if (count >= minStaff) satisfiedSlots++;
    }
  }

  const coverageRate =
    requiredSlots === 0 ? 100 : Number(((satisfiedSlots / requiredSlots) * 100).toFixed(1));
  const preferenceMatchRate =
    weeklyOffs === 0 ? 100 : Number(((prefMatchedOffs / weeklyOffs) * 100).toFixed(1));

  // Daily headcount distribution stats
  const dailyWorkingSeries = monthDates.map((date) => ({
    date,
    workingCount: dailyWorkingMap.get(date) || 0,
  }));
  const counts = dailyWorkingSeries.map((d) => d.workingCount);
  const dailyMinWorking = counts.length ? Math.min(...counts) : 0;
  const dailyMaxWorking = counts.length ? Math.max(...counts) : 0;
  const mean = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
  const variance =
    counts.length > 0
      ? counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / counts.length
      : 0;
  const dailyHeadcountStdDev = Number(Math.sqrt(variance).toFixed(2));

  const errorCount = conflicts.filter((c) => c.severity === 'ERROR').length;
  const warningCount = conflicts.filter((c) => c.severity === 'WARNING').length;
  const burnoutWarnings = conflicts.filter((c) => c.type === 'CONSECUTIVE_DAYS').length;
  const noWeeklyOffWarnings = conflicts.filter((c) => c.type === 'NO_WEEKLY_OFF').length;
  const prefMismatchWarnings = conflicts.filter((c) => c.type === 'PREFERENCE_VIOLATION').length;

  return {
    metrics: {
      totalEntries: entries.length,
      workingDays,
      weeklyOffs,
      leaves: leavesCount,
      compOffs,
      holidays: holidaysCount,
      totalConflicts: conflicts.length,
      errorCount,
      warningCount,
      burnoutWarnings,
      noWeeklyOffWarnings,
      prefMismatchWarnings,
      coverageRate,
      preferenceMatchRate,
      dailyMinWorking,
      dailyMaxWorking,
      dailyHeadcountSpread: dailyMaxWorking - dailyMinWorking,
      dailyHeadcountStdDev,
      weekendOffEmployees: weekendOffEmpSet.size,
    },
    dailyWorkingSeries,
    offDaysByEmployee,
  };
}

/**
 * Generates and compares alternative roster plans without mutating database state.
 *
 * @param {Object} context - Hydrated scheduling context
 * @param {Array<string>} [strategies] - Optional subset of strategies to evaluate
 * @returns {{ plans: Array<Object>, employeesSummary: Array<Object> }}
 */
export function comparePlans(context, strategies = VALID_STRATEGIES) {
  const activeStrategies = strategies.filter((s) => VALID_STRATEGIES.includes(s));
  const strategiesToRun = activeStrategies.length > 0 ? activeStrategies : VALID_STRATEGIES;

  const plans = strategiesToRun.map((strategy) => {
    const meta = STRATEGY_META[strategy];
    const { entries, conflicts } = generateRoster(context, { strategy });
    const computed = computePlanMetrics({ entries, conflicts, context });

    return {
      strategy,
      label: meta.label,
      shortLabel: meta.shortLabel,
      description: meta.description,
      ...computed,
      conflicts,
      isRecommended: false,
    };
  });

  // Rank plans deterministically to badge the top recommendation
  const ranked = [...plans].sort((a, b) => {
    if (a.metrics.errorCount !== b.metrics.errorCount) {
      return a.metrics.errorCount - b.metrics.errorCount;
    }
    if (b.metrics.coverageRate !== a.metrics.coverageRate) {
      return b.metrics.coverageRate - a.metrics.coverageRate;
    }
    if (a.metrics.warningCount !== b.metrics.warningCount) {
      return a.metrics.warningCount - b.metrics.warningCount;
    }
    if (b.metrics.preferenceMatchRate !== a.metrics.preferenceMatchRate) {
      return b.metrics.preferenceMatchRate - a.metrics.preferenceMatchRate;
    }
    return a.metrics.dailyHeadcountStdDev - b.metrics.dailyHeadcountStdDev;
  });

  if (ranked.length > 0) {
    ranked[0].isRecommended = true;
  }

  const employeesSummary = (context.employees || []).map((e) => ({
    _id: (e._id || e).toString(),
    name: e.name,
    weeklyOffPreference: e.weeklyOffPreference || ['Sunday'],
  }));

  return {
    plans,
    employeesSummary,
  };
}

