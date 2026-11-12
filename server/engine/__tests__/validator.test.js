import { describe, it, expect } from 'vitest';
import { validate } from '../validator.js';

describe('Roster Validator Engine (validator.js)', () => {
  const employees = [
    { _id: 'e1', name: 'Rahul Sharma', weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { _id: 'e2', name: 'Priya Patel', weeklyOffPreference: ['Monday'], maxConsecutiveWorkDays: 6 },
  ];

  const brands = [
    { _id: 'b1', name: 'Alpha Retail' },
    { _id: 'b2', name: 'Beta Pay' },
  ];

  const processes = [
    { _id: 'p1', brandId: 'b1', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 },
    { _id: 'p2', brandId: 'b2', type: 'ACC', calendarRule: { type: 'ALL_365' }, minStaffDefault: 2 },
  ];

  it('detects UNDERSTAFFED_BRAND when a process has zero assigned employees', () => {
    // p2 has no assignments at all
    const assignments = [
      { employeeId: 'e1', processId: 'p1', role: 'primary' },
    ];

    const entries = [
      { employeeId: 'e1', date: '2025-12-01', status: 'WORKING' },
    ];

    const conflicts = validate({
      employees,
      brands,
      processes,
      assignments,
      holidays: [],
      leaves: [],
      entries,
      year: 2025,
      month: 12,
    });

    const understaffed = conflicts.find((c) => c.type === 'UNDERSTAFFED_BRAND');
    expect(understaffed).toBeDefined();
    expect(understaffed?.severity).toBe('ERROR');
    expect(understaffed?.processId).toBe('p2');
  });

  it('detects COVERAGE_GAP and SPOF_RISK when sole resource takes leave', () => {
    // Rahul (e1) is the sole assigned employee for Alpha Retail (b1/p1)
    const assignments = [
      { employeeId: 'e1', processId: 'p1', role: 'primary' },
      { employeeId: 'e2', processId: 'p2', role: 'primary' },
    ];

    // On Dec 1, Rahul is on LEAVE
    const entries = [
      { employeeId: 'e1', date: '2025-12-01', status: 'LEAVE' },
      { employeeId: 'e2', date: '2025-12-01', status: 'WORKING' },
    ];

    const conflicts = validate({
      employees,
      brands,
      processes,
      assignments,
      holidays: [],
      leaves: [{ employeeId: 'e1', date: '2025-12-01', status: 'APPROVED' }],
      entries,
      year: 2025,
      month: 12,
    });

    const gap = conflicts.find((c) => c.type === 'COVERAGE_GAP' && c.date === '2025-12-01');
    expect(gap).toBeDefined();
    expect(gap?.severity).toBe('ERROR');

    const spof = conflicts.find((c) => c.type === 'SPOF_RISK' && c.date === '2025-12-01');
    expect(spof).toBeDefined();
    expect(spof?.severity).toBe('ERROR');
  });

  it('detects DOUBLE_BOOKING when employee allocation exceeds 100% on same date', () => {
    const multiAssignments = [
      { employeeId: 'e1', processId: 'p1', role: 'primary', allocationPercent: 80 },
      { employeeId: 'e1', processId: 'p2', role: 'primary', allocationPercent: 50 },
    ];

    const entries = [
      { employeeId: 'e1', date: '2025-12-01', status: 'WORKING' },
    ];

    const conflicts = validate({
      employees,
      brands,
      processes,
      assignments: multiAssignments,
      holidays: [],
      leaves: [],
      entries,
      year: 2025,
      month: 12,
    });

    const doubleBook = conflicts.find((c) => c.type === 'DOUBLE_BOOKING');
    expect(doubleBook).toBeDefined();
    expect(doubleBook?.severity).toBe('ERROR');
  });

  it('detects CONSECUTIVE_DAYS warning when working days exceed maxConsecutiveWorkDays', () => {
    const singleEmp = [
      { _id: 'e1', name: 'Rahul Sharma', weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 5 },
    ];

    // 7 consecutive working days (Dec 1 to Dec 7)
    const entries = [
      { employeeId: 'e1', date: '2025-12-01', status: 'WORKING' },
      { employeeId: 'e1', date: '2025-12-02', status: 'WORKING' },
      { employeeId: 'e1', date: '2025-12-03', status: 'WORKING' },
      { employeeId: 'e1', date: '2025-12-04', status: 'WORKING' },
      { employeeId: 'e1', date: '2025-12-05', status: 'WORKING' },
      { employeeId: 'e1', date: '2025-12-06', status: 'WORKING' },
      { employeeId: 'e1', date: '2025-12-07', status: 'WORKING' },
    ];

    const conflicts = validate({
      employees: singleEmp,
      brands: [{ _id: 'b1', name: 'Brand 1' }],
      processes: [{ _id: 'p1', brandId: 'b1', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 }],
      assignments: [{ employeeId: 'e1', processId: 'p1', role: 'primary' }],
      holidays: [],
      leaves: [],
      entries,
      year: 2025,
      month: 12,
    });

    const consecutiveWarn = conflicts.find((c) => c.type === 'CONSECUTIVE_DAYS');
    expect(consecutiveWarn).toBeDefined();
    expect(consecutiveWarn?.severity).toBe('WARNING');
  });
});

