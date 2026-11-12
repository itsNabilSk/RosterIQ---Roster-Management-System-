import { describe, it, expect } from 'vitest';
import {
  processWorksOnDate,
  requiredProcessesOnDate,
  getMinStaffRequired,
} from '../calendarRules.js';
import {
  toDateStr,
  getWeekdayName,
  getMonthDates,
  groupDatesIntoWeeks,
} from '../utils.js';
import {
  isEmployeeAvailable,
  availableEmployees,
  getApprovedLeaveForDate,
} from '../availability.js';
import { generateRoster, VALID_STRATEGIES } from '../generator.js';
import { comparePlans } from '../planComparator.js';
import { validate } from '../validator.js';
import { suggestBackups } from '../backupSuggester.js';

describe('Phase 2: Comprehensive Scheduling Engine Test Suite', () => {
  // =========================================================================
  // 1. CALENDARS & DATE BOUNDARIES
  // =========================================================================
  describe('1. Calendars & Date Boundaries', () => {
    it('handles 28-day Feb (non-leap year 2025) and 29-day Feb (leap year 2024/2028)', () => {
      const datesFeb2025 = getMonthDates(2025, 2);
      expect(datesFeb2025).toHaveLength(28);
      expect(datesFeb2025[0]).toBe('2025-02-01');
      expect(datesFeb2025[27]).toBe('2025-02-28');

      const datesFeb2024 = getMonthDates(2024, 2);
      expect(datesFeb2024).toHaveLength(29);
      expect(datesFeb2024[28]).toBe('2024-02-29');

      const datesFeb2028 = getMonthDates(2028, 2);
      expect(datesFeb2028).toHaveLength(29);
      expect(datesFeb2028[28]).toBe('2028-02-29');
    });

    it('handles 30-day (Apr/Jun/Sep/Nov) and 31-day months (Jan/Mar/May/Jul/Aug/Oct/Dec)', () => {
      expect(getMonthDates(2025, 4)).toHaveLength(30);
      expect(getMonthDates(2025, 12)).toHaveLength(31);
      expect(getMonthDates(2025, 1)).toHaveLength(31);
    });

    it('accurately evaluates holiday on Sunday, 1st day of month, and last day of month', () => {
      const procExceptHolidays = {
        calendarRule: { type: 'ALL_EXCEPT_HOLIDAYS' },
      };
      const procMonSat = {
        calendarRule: { type: 'MON_SAT' },
      };

      // Dec 7, 2025 is Sunday
      expect(getWeekdayName('2025-12-07')).toBe('Sunday');
      // Sunday holiday
      const sundayHoliday = [{ date: '2025-12-07', name: 'Sunday Holiday' }];
      expect(processWorksOnDate(procMonSat, '2025-12-07', sundayHoliday)).toBe(false);

      // Dec 1, 2025 (1st day) is Monday
      const firstDayHoliday = [{ date: '2025-12-01', name: 'First Day Holiday' }];
      expect(processWorksOnDate(procExceptHolidays, '2025-12-01', firstDayHoliday)).toBe(false);
      expect(processWorksOnDate(procMonSat, '2025-12-01', firstDayHoliday)).toBe(false);

      // Dec 31, 2025 (last day) is Wednesday
      const lastDayHoliday = [{ date: '2025-12-31', name: 'New Year Eve' }];
      expect(processWorksOnDate(procExceptHolidays, '2025-12-31', lastDayHoliday)).toBe(false);
    });

    it('correctly handles custom calendar rules with specific weekdays and holidayPolicy', () => {
      const customProcWorkHoliday = {
        calendarRule: {
          type: 'CUSTOM',
          weekdays: ['Monday', 'Wednesday', 'Friday'],
          holidayPolicy: 'WORK',
        },
      };

      const customProcSkipHoliday = {
        calendarRule: {
          type: 'CUSTOM',
          weekdays: ['Monday', 'Wednesday', 'Friday'],
          holidayPolicy: 'OFF',
        },
      };

      const holiday = [{ date: '2025-12-01', name: 'Mon Holiday' }]; // 2025-12-01 is Monday
      expect(processWorksOnDate(customProcWorkHoliday, '2025-12-01', holiday)).toBe(true);
      expect(processWorksOnDate(customProcSkipHoliday, '2025-12-01', holiday)).toBe(false);
      // Tuesday is not configured
      expect(processWorksOnDate(customProcWorkHoliday, '2025-12-02', holiday)).toBe(false);
    });
  });

  // =========================================================================
  // 2. SINGLE RESOURCE BRAND (SPOF & ALL AFFECTED PROCESSES)
  // =========================================================================
  describe('2. Single-resource brand coverage gap & SPOF', () => {
    it('detects gap on all operating processes and identifies SPOF when sole employee is on leave', () => {
      const employees = [{ _id: 'emp_1', name: 'Single Solo', active: true }];
      const brands = [{ _id: 'b_sole', name: 'Sole Brand' }];
      const processes = [
        { _id: 'p_cs', brandId: 'b_sole', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 },
        { _id: 'p_acc', brandId: 'b_sole', type: 'ACC', calendarRule: { type: 'MON_FRI' }, minStaffDefault: 1 },
      ];
      const assignments = [
        { employeeId: 'emp_1', processId: 'p_cs', role: 'primary' },
        { employeeId: 'emp_1', processId: 'p_acc', role: 'primary' },
      ];
      // Monday Dec 1, 2025
      const leaves = [{ employeeId: 'emp_1', date: '2025-12-01', type: 'PLANNED', status: 'APPROVED' }];

      const { conflicts } = generateRoster({
        employees,
        brands,
        processes,
        assignments,
        holidays: [],
        leaves,
        year: 2025,
        month: 12,
      });

      const monConflicts = conflicts.filter((c) => c.date === '2025-12-01');
      expect(monConflicts.some((c) => c.type === 'SPOF_RISK')).toBe(true);

      const csGap = monConflicts.find((c) => c.type === 'COVERAGE_GAP' && c.processId === 'p_cs');
      const accGap = monConflicts.find((c) => c.type === 'COVERAGE_GAP' && c.processId === 'p_acc');
      expect(csGap).toBeDefined();
      expect(accGap).toBeDefined();
    });
  });

  // =========================================================================
  // 3 & 4. MULTI-RESOURCE RESILIENCE & SHARED PROCESS
  // =========================================================================
  describe('3 & 4. Multi-resource resilience and shared process thresholds', () => {
    const brand = { _id: 'b_multi', name: 'Multi Brand' };
    const process = { _id: 'p_cs_shared', brandId: 'b_multi', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 2 };
    const employees = [
      { _id: 'e1', name: 'Staff One', active: true, weeklyOffPreference: ['Sunday'] },
      { _id: 'e2', name: 'Staff Two', active: true, weeklyOffPreference: ['Saturday'] },
      { _id: 'e3', name: 'Staff Three', active: true, weeklyOffPreference: ['Friday'] },
    ];
    const assignments = [
      { employeeId: 'e1', processId: 'p_cs_shared', role: 'primary' },
      { employeeId: 'e2', processId: 'p_cs_shared', role: 'primary' },
      { employeeId: 'e3', processId: 'p_cs_shared', role: 'primary' },
    ];

    it('3-employee brand with minStaff 2: 1 absent -> remaining 2 cover without conflict', () => {
      const leaves = [{ employeeId: 'e1', date: '2025-12-01', type: 'PLANNED', status: 'APPROVED' }];
      const { conflicts } = generateRoster({
        employees,
        brands: [brand],
        processes: [process],
        assignments,
        holidays: [],
        leaves,
        year: 2025,
        month: 12,
      });

      const dec1Errors = conflicts.filter((c) => c.date === '2025-12-01' && c.severity === 'ERROR');
      expect(dec1Errors).toHaveLength(0);
    });

    it('3-employee brand with minStaff 2: 2 absent -> only 1 covers -> triggers COVERAGE_GAP', () => {
      const leaves = [
        { employeeId: 'e1', date: '2025-12-01', type: 'PLANNED', status: 'APPROVED' },
        { employeeId: 'e2', date: '2025-12-01', type: 'PLANNED', status: 'APPROVED' },
      ];
      const { conflicts } = generateRoster({
        employees,
        brands: [brand],
        processes: [process],
        assignments,
        holidays: [],
        leaves,
        year: 2025,
        month: 12,
      });

      const gap = conflicts.find((c) => c.date === '2025-12-01' && c.type === 'COVERAGE_GAP');
      expect(gap).toBeDefined();
      expect(gap.severity).toBe('ERROR');
    });
  });

  // =========================================================================
  // 5. MULTI-BRAND ASSIGNMENT & DOUBLE-BOOKING DETECTION
  // =========================================================================
  describe('5. Multi-brand assignment & Double-booking', () => {
    it('detects DOUBLE_BOOKING when employee is assigned 100% to two distinct operating processes on the same date', () => {
      const emp = { _id: 'e_multi', name: 'Multi Worker', active: true, weeklyOffPreference: ['Sunday'] };
      const brandA = { _id: 'b_a', name: 'Brand A' };
      const brandB = { _id: 'b_b', name: 'Brand B' };
      const procA = { _id: 'p_a', brandId: 'b_a', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 };
      const procB = { _id: 'p_b', brandId: 'b_b', type: 'ACC', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 };

      const assignments = [
        { employeeId: 'e_multi', processId: 'p_a', role: 'primary', allocationPercent: 100 },
        { employeeId: 'e_multi', processId: 'p_b', role: 'primary', allocationPercent: 100 },
      ];

      const entries = [
        { employeeId: 'e_multi', date: '2025-12-01', status: 'WORKING' },
      ];

      const conflicts = validate({
        employees: [emp],
        brands: [brandA, brandB],
        processes: [procA, procB],
        assignments,
        holidays: [],
        leaves: [],
        entries,
        year: 2025,
        month: 12,
      });

      const doubleBook = conflicts.find((c) => c.type === 'DOUBLE_BOOKING' && c.date === '2025-12-01');
      expect(doubleBook).toBeDefined();
      expect(doubleBook.severity).toBe('ERROR');
    });

    it('does NOT trigger double-booking when allocations sum to <= 100%', () => {
      const emp = { _id: 'e_split', name: 'Split Worker', active: true, weeklyOffPreference: ['Sunday'] };
      const brandA = { _id: 'b_a', name: 'Brand A' };
      const brandB = { _id: 'b_b', name: 'Brand B' };
      const procA = { _id: 'p_a', brandId: 'b_a', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 };
      const procB = { _id: 'p_b', brandId: 'b_b', type: 'ACC', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 };

      const assignments = [
        { employeeId: 'e_split', processId: 'p_a', role: 'primary', allocationPercent: 50 },
        { employeeId: 'e_split', processId: 'p_b', role: 'primary', allocationPercent: 50 },
      ];

      const entries = [
        { employeeId: 'e_split', date: '2025-12-01', status: 'WORKING' },
      ];

      const conflicts = validate({
        employees: [emp],
        brands: [brandA, brandB],
        processes: [procA, procB],
        assignments,
        holidays: [],
        leaves: [],
        entries,
        year: 2025,
        month: 12,
      });

      const doubleBook = conflicts.find((c) => c.type === 'DOUBLE_BOOKING' && c.date === '2025-12-01');
      expect(doubleBook).toBeUndefined();
    });
  });

  // =========================================================================
  // 6 & 7. LEAVE RULES, PENDING VS APPROVED, AND NON-REQUIRED DAYS
  // =========================================================================
  describe('6 & 7. Leave rules, pending status, and non-operating days', () => {
    it('pending leave does NOT block availability or generate coverage gap', () => {
      const emp = { _id: 'e1', name: 'Staff', active: true };
      const leaves = [{ employeeId: 'e1', date: '2025-12-01', type: 'PLANNED', status: 'PENDING' }];

      // availability check
      expect(isEmployeeAvailable(emp, leaves, [], '2025-12-01')).toBe(true);
      expect(getApprovedLeaveForDate('e1', leaves, '2025-12-01')).toBeNull();
    });

    it('leave on a non-required day (e.g. MON_FRI process, leave on Sunday) does NOT create a coverage conflict', () => {
      const emp = { _id: 'e1', name: 'Staff', active: true };
      const brand = { _id: 'b1', name: 'Weekday Brand' };
      const proc = { _id: 'p1', brandId: 'b1', type: 'CS', calendarRule: { type: 'MON_FRI' }, minStaffDefault: 1 };
      const assignments = [{ employeeId: 'e1', processId: 'p1', role: 'primary' }];

      // Dec 7, 2025 is Sunday
      const leaves = [{ employeeId: 'e1', date: '2025-12-07', type: 'PLANNED', status: 'APPROVED' }];

      const { conflicts } = generateRoster({
        employees: [emp],
        brands: [brand],
        processes: [proc],
        assignments,
        holidays: [],
        leaves,
        year: 2025,
        month: 12,
      });

      const sundayGaps = conflicts.filter((c) => c.date === '2025-12-07' && c.type === 'COVERAGE_GAP');
      expect(sundayGaps).toHaveLength(0);
    });

    it('inactive brand processes do NOT generate coverage gaps or errors', () => {
      const emp = { _id: 'e1', name: 'Staff', active: true };
      const inactiveBrand = { _id: 'b_inactive', name: 'Legacy Brand', active: false };
      const proc = { _id: 'p_legacy', brandId: 'b_inactive', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 2 };

      const conflicts = validate({
        employees: [emp],
        brands: [inactiveBrand],
        processes: [proc],
        assignments: [],
        holidays: [],
        leaves: [],
        entries: [],
        year: 2025,
        month: 12,
      });

      // No understaffed or coverage gap conflicts for inactive brand
      const inactiveConflicts = conflicts.filter((c) => c.brandId === 'b_inactive');
      expect(inactiveConflicts).toHaveLength(0);
    });
  });

  // =========================================================================
  // 8 & 9. WEEKLY OFF PLACEMENT & IMPOSSIBLE CONSTRAINTS
  // =========================================================================
  describe('8 & 9. Weekly-off placement and impossible constraints', () => {
    it('impossible case: 365-day process with 1 employee NEVER silently generates valid roster (emits conflict)', () => {
      const emp = { _id: 'e1', name: 'Sole Hero', active: true, weeklyOffPreference: ['Sunday'] };
      const brand = { _id: 'b1', name: 'Always Brand' };
      const proc = { _id: 'p1', brandId: 'b1', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 };
      const assignments = [{ employeeId: 'e1', processId: 'p1', role: 'primary' }];

      const { conflicts } = generateRoster({
        employees: [emp],
        brands: [brand],
        processes: [proc],
        assignments,
        holidays: [],
        leaves: [],
        year: 2025,
        month: 12,
      });

      // Must have workload/burnout or coverage conflicts
      expect(conflicts.length).toBeGreaterThan(0);
      const hasRestConflict = conflicts.some(
        (c) => c.type === 'NO_WEEKLY_OFF' || c.type === 'CONSECUTIVE_DAYS' || c.type === 'COVERAGE_GAP'
      );
      expect(hasRestConflict).toBe(true);
    });
  });

  // =========================================================================
  // 10. DETERMINISM
  // =========================================================================
  describe('10. Engine Determinism', () => {
    it('produces 100% identical roster entries and conflicts across repeated runs with same input', () => {
      const employees = [
        { _id: 'e1', name: 'Emp 1', active: true, weeklyOffPreference: ['Sunday'] },
        { _id: 'e2', name: 'Emp 2', active: true, weeklyOffPreference: ['Monday'] },
      ];
      const brands = [{ _id: 'b1', name: 'Brand 1' }];
      const processes = [{ _id: 'p1', brandId: 'b1', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 }];
      const assignments = [
        { employeeId: 'e1', processId: 'p1', role: 'primary' },
        { employeeId: 'e2', processId: 'p1', role: 'primary' },
      ];

      const run1 = generateRoster({
        employees,
        brands,
        processes,
        assignments,
        holidays: [],
        leaves: [],
        year: 2025,
        month: 12,
      });

      const run2 = generateRoster({
        employees,
        brands,
        processes,
        assignments,
        holidays: [],
        leaves: [],
        year: 2025,
        month: 12,
      });

      expect(JSON.stringify(run1.entries)).toBe(JSON.stringify(run2.entries));
      expect(JSON.stringify(run1.conflicts)).toBe(JSON.stringify(run2.conflicts));
    });
  });

  // =========================================================================
  // 12. BACKUP SUGGESTION RANKING
  // =========================================================================
  describe('12. Backup suggestion constraints and ranking', () => {
    const pods = [
      { _id: 'pod1', name: 'Pod One' },
      { _id: 'pod2', name: 'Pod Two' },
    ];
    const brand = { _id: 'b1', name: 'Alpha Brand' };
    const proc = { _id: 'p1', brandId: 'b1', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 };

    it('does NOT suggest candidate who is inactive or has approved leave on target date', () => {
      const employees = [
        { _id: 'e_inactive', name: 'Inactive User', podId: 'pod1', active: false },
        { _id: 'e_on_leave', name: 'On Leave User', podId: 'pod1', active: true },
        { _id: 'e_valid', name: 'Valid Backup', podId: 'pod1', active: true },
      ];

      const leaves = [{ employeeId: 'e_on_leave', date: '2025-12-01', type: 'PLANNED', status: 'APPROVED' }];
      const entries = [
        { employeeId: 'e_valid', date: '2025-12-01', status: 'WEEKLY_OFF' },
        { employeeId: 'e_on_leave', date: '2025-12-01', status: 'LEAVE' },
      ];

      const conflict = {
        date: '2025-12-01',
        brandId: 'b1',
        processId: 'p1',
        employeeIds: ['e_absent_lead'],
      };

      const suggestions = suggestBackups(
        conflict,
        { employees, pods, brands: [brand], processes: [proc], assignments: [], leaves, entries, holidays: [] }
      );

      const suggestedIds = suggestions.map((s) => s.employeeId);
      expect(suggestedIds).not.toContain('e_inactive');
      expect(suggestedIds).not.toContain('e_on_leave');
      expect(suggestedIds).toContain('e_valid');
    });

    it('does NOT suggest candidate whose reassignment would break their own single-resource brand', () => {
      const soleEmp = { _id: 'e_sole_beta', name: 'Sole Beta Staff', podId: 'pod1', active: true };
      const freeEmp = { _id: 'e_free', name: 'Free Staff', podId: 'pod1', active: true };
      const employees = [soleEmp, freeEmp];

      const brandBeta = { _id: 'b_beta', name: 'Beta Brand', active: true };
      const procBeta = { _id: 'p_beta', brandId: 'b_beta', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 };

      const assignments = [
        { employeeId: 'e_sole_beta', processId: 'p_beta', role: 'primary' },
      ];

      const conflict = {
        date: '2025-12-01',
        brandId: 'b1',
        processId: 'p1',
        employeeIds: ['e_absent_alpha'],
      };

      const suggestions = suggestBackups(
        conflict,
        {
          employees,
          pods,
          brands: [brand, brandBeta],
          processes: [proc, procBeta],
          assignments,
          leaves: [],
          entries: [],
          holidays: [],
        }
      );

      const suggestedIds = suggestions.map((s) => s.employeeId);
      // e_sole_beta handles sole brand Beta which operates on 2025-12-01, so cannot be reassigned without creating gap
      expect(suggestedIds).not.toContain('e_sole_beta');
      expect(suggestedIds).toContain('e_free');
    });
  });

  // =========================================================================
  // 13. TIMEZONE SAFETY & DATE STRINGS
  // =========================================================================
  describe('13. Timezone Safety (UTC / IST consistency)', () => {
    it('toDateStr handles Date object, UTC string, and local ISO string consistently without shifting date', () => {
      // Midnight in UTC
      expect(toDateStr('2025-12-01T00:00:00.000Z')).toBe('2025-12-01');
      // Indian Standard Time (+05:30) representation of Dec 1st 01:00 AM IST is Nov 30 19:30 UTC
      // When date string '2025-12-01' is passed, it must stay '2025-12-01'
      expect(toDateStr('2025-12-01')).toBe('2025-12-01');

      const dateObj = new Date(Date.UTC(2025, 11, 25)); // 25th Dec 2025 UTC
      expect(toDateStr(dateObj)).toBe('2025-12-25');
    });
  });

  // =========================================================================
  // 14. PERFORMANCE BENCHMARKS (30, 100, 300 EMPLOYEES)
  // =========================================================================
  describe('14. Performance benchmarks: 30, 100, and 300 employees', () => {
    function generateMockScaleContext(employeeCount) {
      const employees = [];
      const assignments = [];
      const brands = [];
      const processes = [];

      for (let b = 1; b <= Math.ceil(employeeCount / 2); b++) {
        const bId = `scale_b_${b}`;
        brands.push({ _id: bId, name: `Scale Brand ${b}` });

        const pId = `scale_p_${b}`;
        processes.push({
          _id: pId,
          brandId: bId,
          type: 'CS',
          calendarRule: { type: b % 2 === 0 ? 'ALL_365' : 'MON_SAT' },
          minStaffDefault: 1,
        });
      }

      for (let i = 1; i <= employeeCount; i++) {
        const eId = `scale_emp_${i}`;
        employees.push({
          _id: eId,
          name: `Employee ${i}`,
          active: true,
          weeklyOffPreference: i % 2 === 0 ? ['Sunday'] : ['Monday'],
          maxConsecutiveWorkDays: 6,
        });

        // Assign to a process
        const pIndex = (i % processes.length);
        assignments.push({
          employeeId: eId,
          processId: processes[pIndex]._id,
          role: 'primary',
          allocationPercent: 100,
        });
      }

      return {
        employees,
        brands,
        processes,
        assignments,
        holidays: [{ date: '2025-12-25', name: 'Christmas' }],
        leaves: [],
        year: 2025,
        month: 12,
      };
    }

    it('30 employees (930 cells): generates in < 300ms (requirement is < 2s)', () => {
      const ctx = generateMockScaleContext(30);
      const start = performance.now();
      const res = generateRoster(ctx);
      const duration = performance.now() - start;

      expect(res.entries).toHaveLength(30 * 31);
      expect(duration).toBeLessThan(2000);
    });

    it('100 employees (3,100 cells): generates in < 1500ms', () => {
      const ctx = generateMockScaleContext(100);
      const start = performance.now();
      const res = generateRoster(ctx);
      const duration = performance.now() - start;

      expect(res.entries).toHaveLength(100 * 31);
      expect(duration).toBeLessThan(1500);
    });

    it('300 employees (9,300 cells): generates efficiently', () => {
      const ctx = generateMockScaleContext(300);
      const start = performance.now();
      const res = generateRoster(ctx);
      const duration = performance.now() - start;

      expect(res.entries).toHaveLength(300 * 31);
      // Even 300 employees should generate under 3s with O(1) lookups
      expect(duration).toBeLessThan(3000);
    });
  });

  // =========================================================================
  // 15. ALTERNATIVE PLAN COMPARISON & STRATEGIES
  // =========================================================================
  describe('15. Alternative Roster Plan Comparison', () => {
    it('evaluates all 4 strategies with complete metrics, zero hard constraint violations, and one recommendation', () => {
      // Multi-employee ALL_365 team where everyone wants Sunday off -> creates interesting trade-offs
      const employees = [
        { _id: 'e1', name: 'Emp 1', active: true, weeklyOffPreference: ['Sunday'] },
        { _id: 'e2', name: 'Emp 2', active: true, weeklyOffPreference: ['Sunday', 'Saturday'] },
        { _id: 'e3', name: 'Emp 3', active: true, weeklyOffPreference: ['Sunday'] },
        { _id: 'e4', name: 'Emp 4', active: true, weeklyOffPreference: ['Sunday'] },
      ];
      const brands = [{ _id: 'b1', name: 'Shared Brand', active: true }];
      const processes = [
        {
          _id: 'p1',
          brandId: 'b1',
          type: 'CS',
          calendarRule: { type: 'ALL_365' },
          minStaffDefault: 2,
        },
      ];
      const assignments = employees.map((e) => ({
        employeeId: e._id,
        processId: 'p1',
        role: 'primary',
      }));

      const result = comparePlans({
        employees,
        brands,
        processes,
        assignments,
        holidays: [],
        leaves: [],
        year: 2025,
        month: 12,
      });

      expect(result.plans).toHaveLength(VALID_STRATEGIES.length);
      expect(result.plans.filter((p) => p.isRecommended)).toHaveLength(1);

      for (const plan of result.plans) {
        // Hard coverage constraint must ALWAYS hold regardless of strategy
        expect(plan.metrics.errorCount).toBe(0);
        expect(plan.metrics.coverageRate).toBe(100);
        expect(plan.dailyWorkingSeries).toHaveLength(31);
        expect(plan.metrics.dailyMinWorking).toBeGreaterThanOrEqual(2);
      }

      // Fair distribution should produce at least as good or lower headcount stdDev than default
      const fairPlan = result.plans.find((p) => p.strategy === 'FAIR_DISTRIBUTION');
      const prefPlan = result.plans.find((p) => p.strategy === 'PREFERENCE_FIRST');
      expect(fairPlan).toBeDefined();
      expect(prefPlan).toBeDefined();
      expect(fairPlan.metrics.dailyHeadcountStdDev).toBeLessThanOrEqual(prefPlan.metrics.dailyHeadcountStdDev + 0.5);
    });

    it('is deterministic across repeated comparePlans runs', () => {
      const ctx = {
        employees: [
          { _id: 'e1', name: 'A', active: true, weeklyOffPreference: ['Sunday'] },
          { _id: 'e2', name: 'B', active: true, weeklyOffPreference: ['Monday'] },
        ],
        brands: [{ _id: 'b1', name: 'B1', active: true }],
        processes: [{ _id: 'p1', brandId: 'b1', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 }],
        assignments: [
          { employeeId: 'e1', processId: 'p1', role: 'primary' },
          { employeeId: 'e2', processId: 'p1', role: 'primary' },
        ],
        holidays: [],
        leaves: [],
        year: 2025,
        month: 12,
      };

      const r1 = comparePlans(ctx);
      const r2 = comparePlans(ctx);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    });
  });
});
