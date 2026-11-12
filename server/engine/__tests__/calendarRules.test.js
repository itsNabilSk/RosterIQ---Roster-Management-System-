import { describe, it, expect } from 'vitest';
import {
  processWorksOnDate,
  requiredProcessesOnDate,
  getMinStaffRequired,
} from '../calendarRules.js';

describe('Calendar Rules Engine (calendarRules.js)', () => {
  const holidays = [
    { date: '2025-12-25', name: 'Christmas Day' },
    { date: '2025-12-31', name: "New Year's Eve" },
  ];

  // 1. ALL_365 Rule
  describe('Rule: ALL_365', () => {
    const process365 = {
      _id: 'proc_365',
      calendarRule: { type: 'ALL_365' },
    };

    it('operates on regular weekdays, weekends, and holidays', () => {
      // Monday
      expect(processWorksOnDate(process365, '2025-12-01', holidays)).toBe(true);
      // Sunday
      expect(processWorksOnDate(process365, '2025-12-07', holidays)).toBe(true);
      // Christmas holiday
      expect(processWorksOnDate(process365, '2025-12-25', holidays)).toBe(true);
    });
  });

  // 2. ALL_EXCEPT_HOLIDAYS Rule
  describe('Rule: ALL_EXCEPT_HOLIDAYS', () => {
    const procNoHolidays = {
      _id: 'proc_no_holidays',
      calendarRule: { type: 'ALL_EXCEPT_HOLIDAYS' },
    };

    it('operates on normal days and weekends, but skips holidays', () => {
      expect(processWorksOnDate(procNoHolidays, '2025-12-01', holidays)).toBe(true);
      expect(processWorksOnDate(procNoHolidays, '2025-12-07', holidays)).toBe(true);
      // Christmas holiday -> should NOT work
      expect(processWorksOnDate(procNoHolidays, '2025-12-25', holidays)).toBe(false);
    });
  });

  // 3. MON_SAT Rule
  describe('Rule: MON_SAT', () => {
    const procMonSat = {
      _id: 'proc_mon_sat',
      calendarRule: { type: 'MON_SAT' },
    };

    it('operates Mon-Sat, skips Sunday, and skips holidays', () => {
      // Monday
      expect(processWorksOnDate(procMonSat, '2025-12-01', holidays)).toBe(true);
      // Saturday (Dec 6, 2025)
      expect(processWorksOnDate(procMonSat, '2025-12-06', holidays)).toBe(true);
      // Sunday (Dec 7, 2025) -> should NOT work
      expect(processWorksOnDate(procMonSat, '2025-12-07', holidays)).toBe(false);
      // Christmas (Thursday Dec 25, 2025) -> holiday on Mon-Sat, skips
      expect(processWorksOnDate(procMonSat, '2025-12-25', holidays)).toBe(false);
    });
  });

  // 4. MON_FRI Rule
  describe('Rule: MON_FRI', () => {
    const procMonFri = {
      _id: 'proc_mon_fri',
      calendarRule: { type: 'MON_FRI' },
    };

    it('operates Mon-Fri only, skips Saturday, Sunday, and holidays', () => {
      // Monday
      expect(processWorksOnDate(procMonFri, '2025-12-01', holidays)).toBe(true);
      // Friday (Dec 5, 2025)
      expect(processWorksOnDate(procMonFri, '2025-12-05', holidays)).toBe(true);
      // Saturday (Dec 6, 2025) -> should NOT work
      expect(processWorksOnDate(procMonFri, '2025-12-06', holidays)).toBe(false);
      // Sunday (Dec 7, 2025) -> should NOT work
      expect(processWorksOnDate(procMonFri, '2025-12-07', holidays)).toBe(false);
      // Christmas (Thursday Dec 25, 2025) -> should NOT work
      expect(processWorksOnDate(procMonFri, '2025-12-25', holidays)).toBe(false);
    });
  });

  // 5. CUSTOM Rule
  describe('Rule: CUSTOM', () => {
    it('honors configured weekdays and holidayPolicy: SKIP', () => {
      const procCustomSkip = {
        _id: 'proc_custom_skip',
        calendarRule: {
          type: 'CUSTOM',
          weekdays: ['Tuesday', 'Thursday'],
          holidayPolicy: 'SKIP',
        },
      };

      // Tuesday Dec 2, 2025 -> works
      expect(processWorksOnDate(procCustomSkip, '2025-12-02', holidays)).toBe(true);
      // Wednesday Dec 3, 2025 -> not in weekdays
      expect(processWorksOnDate(procCustomSkip, '2025-12-03', holidays)).toBe(false);
      // Thursday Dec 25, 2025 (Christmas) -> in weekdays but SKIP policy
      expect(processWorksOnDate(procCustomSkip, '2025-12-25', holidays)).toBe(false);
    });

    it('honors configured weekdays and holidayPolicy: WORK', () => {
      const procCustomWork = {
        _id: 'proc_custom_work',
        calendarRule: {
          type: 'CUSTOM',
          weekdays: ['Thursday'],
          holidayPolicy: 'WORK',
        },
      };

      // Thursday Dec 25, 2025 (Christmas) -> in weekdays AND holidayPolicy is WORK
      expect(processWorksOnDate(procCustomWork, '2025-12-25', holidays)).toBe(true);
    });
  });

  // requiredProcessesOnDate test
  describe('requiredProcessesOnDate', () => {
    it('correctly filters required processes for a specific day', () => {
      const procs = [
        { _id: '1', calendarRule: { type: 'ALL_365' } },
        { _id: '2', calendarRule: { type: 'MON_FRI' } },
        { _id: '3', calendarRule: { type: 'ALL_EXCEPT_HOLIDAYS' } },
      ];

      // Sunday Dec 7: proc 1 and 3 work, proc 2 (Mon-Fri) does not
      const activeSunday = requiredProcessesOnDate(procs, '2025-12-07', holidays);
      expect(activeSunday.map((p) => p._id)).toEqual(['1', '3']);

      // Christmas Dec 25 (Thursday): proc 1 works, proc 2 & 3 skip
      const activeChristmas = requiredProcessesOnDate(procs, '2025-12-25', holidays);
      expect(activeChristmas.map((p) => p._id)).toEqual(['1']);
    });
  });

  // getMinStaffRequired test
  describe('getMinStaffRequired', () => {
    it('returns default minStaff when no weekday override is present', () => {
      const proc = { minStaffDefault: 2 };
      expect(getMinStaffRequired(proc, '2025-12-01')).toBe(2);
    });

    it('returns overridden minStaff for configured weekday', () => {
      const proc = {
        minStaffDefault: 1,
        minStaffByWeekday: {
          Monday: 3, // peak Monday surge
        },
      };
      // Monday Dec 1 -> should return 3
      expect(getMinStaffRequired(proc, '2025-12-01')).toBe(3);
      // Tuesday Dec 2 -> should return default 1
      expect(getMinStaffRequired(proc, '2025-12-02')).toBe(1);
    });
  });
});

