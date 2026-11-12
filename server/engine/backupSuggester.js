import { toDateStr, groupDatesIntoWeeks } from './utils.js';
import { getApprovedLeaveForDate } from './availability.js';
import { processWorksOnDate } from './calendarRules.js';

/**
 * Recommends the top available backup employees to fill a coverage gap.
 * Pure deterministic ranking function with zero DB calls.
 *
 * Ranking criteria:
 * 1. Same Pod affinity (+50 pts)
 * 2. Brand familiarity / existing assignment (+30 pts)
 * 3. Free on target date (+25 pts)
 * 4. Lowest workload in current week (+15 pts)
 * 5. No conflicting critical assignments (+15 pts)
 *
 * @param {Object} conflict - The conflict object { date, brandId, processId, employeeIds }
 * @param {Object} context - { employees, pods, brands, processes, assignments, leaves, entries, holidays }
 * @param {number} [limit=3] - Maximum candidates to return (default 3)
 * @returns {Array<Object>} Top candidate objects with rank, score, and reasons
 */
export function suggestBackups(conflict, context, limit = 3) {
  const {
    employees = [],
    pods = [],
    brands = [],
    processes = [],
    assignments = [],
    leaves = [],
    entries = [],
    holidays = [],
  } = context;

  const targetDateStr = toDateStr(conflict.date);
  const targetProcessId = (conflict.processId?._id || conflict.processId)?.toString();
  const targetBrandId = (conflict.brandId?._id || conflict.brandId)?.toString();
  const unavailableEmpIds = (conflict.employeeIds || []).map((id) =>
    (id?._id || id).toString()
  );

  // Fast Lookups
  const podMap = new Map(pods.map((p) => [(p._id || p).toString(), p]));
  const brandMap = new Map(brands.map((b) => [(b._id || b).toString(), b]));
  const procMap = new Map(processes.map((p) => [(p._id || p).toString(), p]));
  const empMap = new Map(employees.map((e) => [(e._id || e).toString(), e]));

  // Find target pod
  let targetPodId = null;
  if (unavailableEmpIds.length > 0) {
    const unavailEmp = empMap.get(unavailableEmpIds[0]);
    if (unavailEmp?.podId) {
      targetPodId = (unavailEmp.podId?._id || unavailEmp.podId).toString();
    }
  }

  // Index entries by `empId:dateStr` -> status
  const entryLookup = new Map();
  for (const entry of entries) {
    const eEmpId = (entry.employeeId?._id || entry.employeeId).toString();
    const eDateStr = toDateStr(entry.date);
    entryLookup.set(`${eEmpId}:${eDateStr}`, entry.status);
  }

  // Identify week dates around targetDateStr
  const allDates = Array.from(new Set(entries.map((e) => toDateStr(e.date)))).sort();
  const weeks = groupDatesIntoWeeks(allDates);
  const currentWeek =
    weeks.find((w) => w.includes(targetDateStr)) || [targetDateStr];

  // Candidates Evaluation
  const scoredCandidates = [];

  for (const candidate of employees) {
    const cId = (candidate._id || candidate).toString();

    // Exclude the unavailable employee
    if (unavailableEmpIds.includes(cId)) continue;
    if (candidate.active === false) continue;

    // Must NOT have approved leave on target date
    const leave = getApprovedLeaveForDate(cId, leaves, targetDateStr);
    if (leave) continue;

    const currentStatus = entryLookup.get(`${cId}:${targetDateStr}`) || 'WORKING';
    // Must NOT be marked as on LEAVE or COMP_OFF in the current roster
    if (currentStatus === 'LEAVE' || currentStatus === 'COMP_OFF') continue;

    let score = 0;
    const reasons = [];

    // 1. Same Pod Affinity (+50 pts)
    const cPodId = (candidate.podId?._id || candidate.podId)?.toString();
    const cPod = podMap.get(cPodId);
    const podName = cPod ? cPod.name : 'Unknown Pod';

    if (targetPodId && cPodId === targetPodId) {
      score += 50;
      reasons.push(`Same Pod: ${podName}`);
    }

    // 2. Brand Familiarity / Existing Brand Assignment (+30 pts)
    const candidateAssignments = assignments.filter((a) => {
      const aEmpId = (a.employeeId?._id || a.employeeId).toString();
      return aEmpId === cId;
    });

    const isAssignedToThisProcess = candidateAssignments.some((a) => {
      const pId = (a.processId?._id || a.processId).toString();
      return pId === targetProcessId;
    });

    const isAssignedToThisBrand = candidateAssignments.some((a) => {
      const pId = (a.processId?._id || a.processId).toString();
      const p = procMap.get(pId);
      return p && (p.brandId?._id || p.brandId).toString() === targetBrandId;
    });

    if (isAssignedToThisProcess) {
      score += 40;
      reasons.push(`Designated Backup for this exact process`);
    } else if (isAssignedToThisBrand) {
      score += 30;
      reasons.push(`Brand Familiarity: Active on other brand processes`);
    }

    // 3. Status on Target Date (+25 pts if free/weekly off)
    if (currentStatus === 'WEEKLY_OFF') {
      score += 25;
      reasons.push(`Scheduled on Weekly Off (available for recall)`);
    } else if (currentStatus === 'HOLIDAY') {
      score += 20;
      reasons.push(`Observing Holiday (can cover critical duty)`);
    } else {
      score += 10;
      reasons.push(`Active on shift (can absorb additional coverage)`);
    }

    // 4. Lowest Workload this Week (+15 pts max)
    let workingDaysThisWeek = 0;
    for (const d of currentWeek) {
      if (entryLookup.get(`${cId}:${d}`) === 'WORKING') {
        workingDaysThisWeek++;
      }
    }
    const workloadScore = Math.max(0, 7 - workingDaysThisWeek) * 2;
    score += workloadScore;
    reasons.push(`Current Week Load: ${workingDaysThisWeek} working days`);

    // 5. Check if candidate handles another single-resource brand today
    const handlesSoleBrandToday = candidateAssignments.some((a) => {
      const pId = (a.processId?._id || a.processId).toString();
      const proc = procMap.get(pId);
      if (!proc || !processWorksOnDate(proc, targetDateStr, holidays)) return false;

      // Count staff on that brand
      const bId = (proc.brandId?._id || proc.brandId).toString();
      const bStaff = assignments.filter((otherA) => {
        const otherP = procMap.get((otherA.processId?._id || otherA.processId).toString());
        return otherP && (otherP.brandId?._id || otherP.brandId).toString() === bId;
      });
      return bStaff.length === 1;
    });

    if (handlesSoleBrandToday) {
      // Reassigning this employee would create a new coverage conflict on their own brand
      continue;
    }
    score += 15;
    reasons.push(`Zero Conflict: Does not leave any other brand unstaffed`);

    scoredCandidates.push({
      employeeId: candidate._id || candidate,
      name: candidate.name,
      email: candidate.email,
      podName,
      score,
      reasons,
      currentStatusOnDate: currentStatus,
    });
  }

  // Sort descending by score
  scoredCandidates.sort((a, b) => b.score - a.score);

  return scoredCandidates.slice(0, limit);
}

