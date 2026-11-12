import { describe, it, expect } from 'vitest';
import { generateRoster } from '../generator.js';
import { validate } from '../validator.js';
import { suggestBackups } from '../backupSuggester.js';

describe('Demo Scenario Verification (demo.test.js)', () => {
  // Setup Demo Brands & Employees
  const pods = [
    { _id: 'pod_titan', name: 'Pod Titan (Fintech)' },
    { _id: 'pod_vanguard', name: 'Pod Vanguard (Ops)' },
  ];

  const employees = [
    // Rahul: sole resource for Brand A (Alpha CS)
    { _id: 'emp_rahul', name: 'Rahul Sharma', podId: 'pod_titan', weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6, active: true },
    // Ananya: in same pod (Pod Titan), backup candidate
    { _id: 'emp_ananya', name: 'Ananya Iyer', podId: 'pod_titan', weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6, active: true },
    // Rohan: in same pod (Pod Titan)
    { _id: 'emp_rohan', name: 'Rohan Desai', podId: 'pod_titan', weeklyOffPreference: ['Saturday'], maxConsecutiveWorkDays: 6, active: true },

    // Beta Support team (3 employees)
    { _id: 'emp_sanjay', name: 'Sanjay Chawla', podId: 'pod_vanguard', weeklyOffPreference: ['Sunday'], maxConsecutiveWorkDays: 6, active: true },
    { _id: 'emp_ritu', name: 'Ritu Sen', podId: 'pod_vanguard', weeklyOffPreference: ['Saturday'], maxConsecutiveWorkDays: 6, active: true },
    { _id: 'emp_harish', name: 'Harish Pandey', podId: 'pod_vanguard', weeklyOffPreference: ['Monday'], maxConsecutiveWorkDays: 6, active: true },
  ];

  const brands = [
    { _id: 'brand_alpha', name: 'Alpha CS' },    // Brand A (Single Resource)
    { _id: 'brand_beta', name: 'Beta Support' },  // Brand B (3 employees)
  ];

  // Brand Alpha has CS (ALL_365), ACC (MON_SAT), NDR (MON_FRI)
  const processes = [
    { _id: 'proc_alpha_cs', brandId: 'brand_alpha', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 1 },
    { _id: 'proc_alpha_acc', brandId: 'brand_alpha', type: 'ACC', calendarRule: { type: 'MON_SAT' }, minStaffDefault: 1 },
    { _id: 'proc_alpha_ndr', brandId: 'brand_alpha', type: 'NDR', calendarRule: { type: 'MON_FRI' }, minStaffDefault: 1 },

    // Brand Beta has CS (ALL_365, minStaff: 2)
    { _id: 'proc_beta_cs', brandId: 'brand_beta', type: 'CS', calendarRule: { type: 'ALL_365' }, minStaffDefault: 2 },
  ];

  const assignments = [
    // Rahul handles CS + ACC + NDR for Alpha CS (Single-resource brand)
    { employeeId: 'emp_rahul', processId: 'proc_alpha_cs', role: 'primary' },
    { employeeId: 'emp_rahul', processId: 'proc_alpha_acc', role: 'primary' },
    { employeeId: 'emp_rahul', processId: 'proc_alpha_ndr', role: 'primary' },

    // Beta Support: Sanjay, Ritu, Harish all assigned to Beta CS
    { employeeId: 'emp_sanjay', processId: 'proc_beta_cs', role: 'primary' },
    { employeeId: 'emp_ritu', processId: 'proc_beta_cs', role: 'primary' },
    { employeeId: 'emp_harish', processId: 'proc_beta_cs', role: 'primary' },
  ];

  const targetMonday = '2025-12-01'; // First Monday of Dec 2025

  it('Part 1: Detects SPOF and Coverage Gap when single-resource employee is on leave', () => {
    // Rahul is on approved leave on Monday Dec 1
    const leaves = [
      { employeeId: 'emp_rahul', date: targetMonday, type: 'PLANNED', status: 'APPROVED' },
    ];

    const { entries, conflicts } = generateRoster({
      employees,
      brands,
      processes,
      assignments,
      holidays: [],
      leaves,
      year: 2025,
      month: 12,
    });

    // 1. Verify Rahul is marked as LEAVE on Dec 1
    const rahulEntry = entries.find((e) => e.employeeId === 'emp_rahul' && e.date === targetMonday);
    expect(rahulEntry?.status).toBe('LEAVE');

    // 2. Verify conflicts generated for Alpha CS on Dec 1
    const alphaConflicts = conflicts.filter((c) => c.date === targetMonday && c.brandId === 'brand_alpha');
    expect(alphaConflicts.length).toBeGreaterThan(0);

    // Should detect SPOF_RISK
    const spof = alphaConflicts.find((c) => c.type === 'SPOF_RISK');
    expect(spof).toBeDefined();
    expect(spof?.severity).toBe('ERROR');

    // Should detect COVERAGE_GAP for all operating processes (CS, ACC, NDR all operate on Monday)
    const gapCS = alphaConflicts.find((c) => c.type === 'COVERAGE_GAP' && c.processId === 'proc_alpha_cs');
    const gapACC = alphaConflicts.find((c) => c.type === 'COVERAGE_GAP' && c.processId === 'proc_alpha_acc');
    const gapNDR = alphaConflicts.find((c) => c.type === 'COVERAGE_GAP' && c.processId === 'proc_alpha_ndr');

    expect(gapCS).toBeDefined();
    expect(gapACC).toBeDefined();
    expect(gapNDR).toBeDefined();
  });

  it('Part 2: Suggests available backup employees ranked by pod, familiarity, and workload', () => {
    const leaves = [
      { employeeId: 'emp_rahul', date: targetMonday, type: 'PLANNED', status: 'APPROVED' },
    ];

    const { entries, conflicts } = generateRoster({
      employees,
      brands,
      processes,
      assignments,
      holidays: [],
      leaves,
      year: 2025,
      month: 12,
    });

    const spofConflict = conflicts.find((c) => c.type === 'SPOF_RISK' && c.date === targetMonday);
    expect(spofConflict).toBeDefined();

    const suggestions = suggestBackups(
      spofConflict,
      { employees, pods, brands, processes, assignments, leaves, entries, holidays: [] },
      3
    );

    expect(suggestions.length).toBeGreaterThan(0);
    // Ananya (in same pod: Pod Titan) must be a top suggestion with Same Pod reason
    expect(suggestions[0].name).toBe('Ananya Iyer');
    expect(suggestions[0].reasons.some((r) => r.includes('Same Pod'))).toBe(true);
  });

  it('Part 3: Resolves conflict live when backup is assigned or cell is edited', () => {
    const leaves = [
      { employeeId: 'emp_rahul', date: targetMonday, type: 'PLANNED', status: 'APPROVED' },
    ];

    const { entries } = generateRoster({
      employees,
      brands,
      processes,
      assignments,
      holidays: [],
      leaves,
      year: 2025,
      month: 12,
    });

    // Manager assigns Ananya as backup on Dec 1 for Brand Alpha CS
    const updatedAssignments = [
      ...assignments,
      { employeeId: 'emp_ananya', processId: 'proc_alpha_cs', role: 'primary' },
      { employeeId: 'emp_ananya', processId: 'proc_alpha_acc', role: 'primary' },
      { employeeId: 'emp_ananya', processId: 'proc_alpha_ndr', role: 'primary' },
    ];

    // Ensure Ananya is set to WORKING on Dec 1
    const updatedEntries = entries.map((entry) => {
      if (entry.employeeId === 'emp_ananya' && entry.date === targetMonday) {
        return { ...entry, status: 'WORKING', source: 'MANUAL' };
      }
      return entry;
    });

    // Re-validate roster live
    const refreshedConflicts = validate({
      employees,
      brands,
      processes,
      assignments: updatedAssignments,
      holidays: [],
      leaves,
      entries: updatedEntries,
      year: 2025,
      month: 12,
    });

    // The COVERAGE_GAP for proc_alpha_cs, acc, and ndr should now be RESOLVED
    const remainingAlphaGaps = refreshedConflicts.filter(
      (c) => c.date === targetMonday && c.brandId === 'brand_alpha' && c.type === 'COVERAGE_GAP'
    );
    expect(remainingAlphaGaps).toHaveLength(0);
  });

  it('Part 4: Multi-employee brand (Brand B) with 1 absent and 2 present maintains valid coverage without error', () => {
    // Harish (1 of 3 staff for Beta Support) has approved leave on Monday Dec 1
    const leaves = [
      { employeeId: 'emp_harish', date: targetMonday, type: 'PLANNED', status: 'APPROVED' },
    ];

    const { entries, conflicts } = generateRoster({
      employees,
      brands,
      processes,
      assignments,
      holidays: [],
      leaves,
      year: 2025,
      month: 12,
    });

    // Beta CS minStaff is 2. Sanjay and Ritu are present -> 2 staff available
    const betaErrors = conflicts.filter(
      (c) => c.brandId === 'brand_beta' && c.date === targetMonday && c.severity === 'ERROR'
    );

    // Must be ZERO error conflicts for Beta Support
    expect(betaErrors).toHaveLength(0);
  });
});
