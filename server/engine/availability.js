import { toDateStr } from './utils.js';

/**
 * Checks if an employee has an approved leave or approved comp-off on a specific date.
 *
 * @param {string|Object} employeeId - Employee ID
 * @param {Array} leaves - List of leave objects { employeeId, date, type, status }
 * @param {Date|string} date - Date to check
 * @returns {Object|null} The leave record if found and approved, else null
 */
export function getApprovedLeaveForDate(employeeId, leaves = [], date) {
  const targetEmpId = (employeeId?._id || employeeId).toString();
  const targetDateStr = toDateStr(date);

  return (
    leaves.find((leave) => {
      const empId = (leave.employeeId?._id || leave.employeeId).toString();
      const leaveDateStr = toDateStr(leave.date);
      return (
        empId === targetEmpId &&
        leaveDateStr === targetDateStr &&
        leave.status === 'APPROVED'
      );
    }) || null
  );
}

/**
 * Determines whether an individual employee is available to work on a specific date.
 *
 * An employee is available if:
 * 1. Active is true.
 * 2. Has no approved leave or comp-off on this date.
 * 3. Has no existing roster entry on this date marking them as WEEKLY_OFF, LEAVE, or COMP_OFF.
 *
 * @param {Object} employee - Employee object
 * @param {Array} leaves - List of leaves
 * @param {Array} entries - Existing roster entries (optional)
 * @param {Date|string} date - Target date
 * @returns {boolean} True if available
 */
export function isEmployeeAvailable(employee, leaves = [], entries = [], date) {
  if (!employee || employee.active === false) return false;

  const empId = (employee._id || employee).toString();
  const dateStr = toDateStr(date);

  // 1. Check approved leaves & comp-offs
  const leave = getApprovedLeaveForDate(empId, leaves, dateStr);
  if (leave) {
    return false;
  }

  // 2. Check roster entries for this date if present
  if (entries && entries.length > 0) {
    const entry = entries.find((e) => {
      const eEmpId = (e.employeeId?._id || e.employeeId).toString();
      const eDateStr = toDateStr(e.date);
      return eEmpId === empId && eDateStr === dateStr;
    });

    if (entry) {
      if (
        entry.status === 'WEEKLY_OFF' ||
        entry.status === 'LEAVE' ||
        entry.status === 'COMP_OFF'
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Filters a list of employees to return those who are available on a specific date.
 *
 * @param {Array} employees - List of all employees
 * @param {Array} leaves - List of all leaves
 * @param {Array} entries - Roster entries
 * @param {Date|string} date - Target date
 * @returns {Array} List of available employees
 */
export function availableEmployees(employees = [], leaves = [], entries = [], date) {
  return employees.filter((emp) => isEmployeeAvailable(emp, leaves, entries, date));
}

/**
 * Returns available employees assigned to a specific process on a date,
 * split by role (primary vs backup).
 *
 * @param {Array} assignments - List of all assignments
 * @param {Array} employees - List of all employees
 * @param {Array} leaves - List of leaves
 * @param {Array} entries - Roster entries
 * @param {Date|string} date - Target date
 * @param {string|Object} processId - Target Process ID
 * @returns {{ primary: Array, backup: Array, all: Array }}
 */
export function assignedAndAvailable(
  assignments = [],
  employees = [],
  leaves = [],
  entries = [],
  date,
  processId
) {
  const targetProcId = (processId?._id || processId).toString();

  // Find assignments for this process
  const procAssignments = assignments.filter((a) => {
    const pId = (a.processId?._id || a.processId).toString();
    return pId === targetProcId;
  });

  const empMap = new Map();
  for (const emp of employees) {
    empMap.set(emp._id.toString(), emp);
  }

  const primary = [];
  const backup = [];

  for (const a of procAssignments) {
    const empId = (a.employeeId?._id || a.employeeId).toString();
    const emp = empMap.get(empId);
    if (!emp) continue;

    if (isEmployeeAvailable(emp, leaves, entries, date)) {
      if (a.role === 'backup') {
        backup.push(emp);
      } else {
        primary.push(emp);
      }
    }
  }

  return {
    primary,
    backup,
    all: [...primary, ...backup],
  };
}

