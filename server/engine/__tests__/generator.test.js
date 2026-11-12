import { describe, it, expect } from 'vitest';
import { generateRoster } from '../generator.js';

describe('Roster Generator Engine (generator.js)', () => {
  // Test context with 5 employees and 3 brands
  const employees = [
    { _id: 'e1', name: 'Rahul Sharma', podId: 'pod1', weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { _id: 'e2', name: 'Ananya Iyer', podId: 'pod1', weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
    { _id: 'e3', name: 'Rohan Desai', podId: 'pod1', weeklyOffPreference: ['Saturday'], maxConsecutiveWorkDays: 6 },
    { _id: 'e4', name: 'Priya Patel', podId: 'pod2', weeklyOffPreference: ['Monday'], maxConsecutiveWorkDays: 6 },
    { _id: 'e5', name: 'Amit Verma', podId: 'pod2', weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6 },
  ];

  const brands = [
    { _id: 'b1', name: 'Alpha Brand' },
    { _id: 'b2', name: 'Beta Brand' },
  ];

  const processes = [
    { _id: 'p1', brandId: 'b1', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 },
    { _id: 'p2', brandId: 'b2', type: 'CS', calendarRule: { type: 'MON_FRI' }, minStaffDefault: 1 },
  ];

  const assignments = [
    { employeeId: 'e1', processId: 'p1', role: 'primary' },
    { employeeId: 'e2', processId: 'p1', role: 'backup' },
    { employeeId: 'e3', processId: 'p2', role: 'primary' },
    { employeeId: 'e4', processId: 'p2', role: 'primary' },
    { employeeId: 'e5', processId: 'p2', role: 'backup' },
  ];

  const holidays = [
    { date: '2025-12-25', name: 'Christmas Day' },
  ];

  const leaves = [
    { employeeId: 'e1', date: '2025-12-05', type: 'PLANNED', status: 'APPROVED' },
  ];

  it('generates a full matrix of entries (employees × days)', () => {
    const { entries, conflicts } = generateRoster({
      employees,
      brands,
      processes,
      assignments,
      holidays,
      leaves,
      year: 2025,
      month: 12,
    });

    // 5 employees × 31 days in December = 155 entries
    expect(entries).toHaveLength(5 * 31);
    expect(Array.isArray(conflicts)).toBe(true);

    // Check that Rahul has LEAVE on Dec 5
    const rahulLeave = entries.find(
      (e) => e.employeeId === 'e1' && e.date === '2025-12-05'
    );
    expect(rahulLeave?.status).toBe('LEAVE');
  });

  it('locks public holidays for processes that do not operate on holidays', () => {
    const { entries } = generateRoster({
      employees,
      brands,
      processes,
      assignments,
      holidays,
      leaves,
      year: 2025,
      month: 12,
    });

    // Rohan (e3) is assigned to p2 (MON_FRI), which skips holidays.
    // Dec 25 is Christmas -> Rohan should have HOLIDAY status
    const rohanHoliday = entries.find(
      (e) => e.employeeId === 'e3' && e.date === '2025-12-25'
    );
    expect(rohanHoliday?.status).toBe('HOLIDAY');
  });

  it('benchmark test: generates roster for 32 employees in under 500ms (< 2s requirement)', () => {
    // Generate 32 mock employees
    const largeEmployees = Array.from({ length: 32 }, (_, i) => ({
      _id: `emp_${i + 1}`,
      name: `Employee ${i + 1}`,
      podId: `pod_${(i % 5) + 1}`,
      weeklyOffPreference: [i % 2 === 0 ? 'Sunday' : 'Monday'],
      maxConsecutiveWorkDays: 6,
    }));

    // 20 brands & processes
    const largeBrands = Array.from({ length: 20 }, (_, i) => ({
      _id: `brand_${i + 1}`,
      name: `Brand ${i + 1}`,
    }));

    const largeProcesses = Array.from({ length: 30 }, (_, i) => ({
      _id: `proc_${i + 1}`,
      brandId: `brand_${(i % 20) + 1}`,
      type: 'CS',
      calendarRule: { type: i % 3 === 0 ? 'ALL_365' : 'MON_SAT' },
      minStaffDefault: 1,
    }));

    const largeAssignments = largeProcesses.map((p, idx) => ({
      employeeId: `emp_${(idx % 32) + 1}`,
      processId: p._id,
      role: 'primary',
    }));

    const startTime = performance.now();
    const { entries, conflicts } = generateRoster({
      employees: largeEmployees,
      brands: largeBrands,
      processes: largeProcesses,
      assignments: largeAssignments,
      holidays: [{ date: '2025-12-25', name: 'Christmas' }],
      leaves: [],
      year: 2025,
      month: 12,
    });
    const duration = performance.now() - startTime;

    // 32 employees × 31 days = 992 entries
    expect(entries).toHaveLength(32 * 31);
    expect(duration).toBeLessThan(500); // Super fast (< 500ms)
    console.log(`[Benchmark] Generated 32 employees × 31 days (992 cells) in ${duration.toFixed(2)}ms`);
  });
});

