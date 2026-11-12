const STATUS_CODE = {
  WORKING: 'W',
  WEEKLY_OFF: 'WO',
  LEAVE: 'L',
  COMP_OFF: 'CO',
  HOLIDAY: 'H',
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Escapes a CSV cell safely per RFC 4180 and prevents spreadsheet formula injection.
 */
function escapeCsvCell(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildDateHeader(dStr) {
  const d = new Date(`${dStr}T00:00:00.000Z`);
  const day = d.getUTCDate();
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
  return `${day} ${weekday}`;
}

function buildEntryLookup(entries = []) {
  const map = new Map();
  for (const e of entries) {
    const empId = (e.employeeId?._id || e.employeeId)?.toString();
    const dateStr = (e.date || '').slice(0, 10);
    if (empId && dateStr) {
      map.set(`${empId}:${dateStr}`, e.status || 'WORKING');
    }
  }
  return map;
}

function summarizeEmployeeRow(empId, dates, entryMap) {
  let w = 0;
  let wo = 0;
  let leave = 0;
  let hol = 0;
  const cells = dates.map((dStr) => {
    const status = entryMap.get(`${empId}:${dStr}`) || 'WORKING';
    if (status === 'WORKING') w++;
    else if (status === 'WEEKLY_OFF') wo++;
    else if (status === 'LEAVE' || status === 'COMP_OFF') leave++;
    else if (status === 'HOLIDAY') hol++;
    return STATUS_CODE[status] || status;
  });
  return { cells, w, wo, leave, hol };
}

/**
 * Generates and downloads a UTF-8 CSV file representing the active roster view.
 *
 * @returns {string} The downloaded filename
 */
export function exportRosterToCsv({ roster, viewType, viewData, conflicts = [], month, year }) {
  const dates = viewData?.dates || [];
  const coverageMap = viewData?.coverageMap || {};
  const monthLabel = `${MONTH_NAMES[(month - 1) % 12] || month}-${year}`;
  const rows = [];

  const dateHeaders = dates.map(buildDateHeader);

  // Metadata banner
  rows.push(['RosterIQ Export', `${monthLabel}`, `View: ${viewType.toUpperCase()}`, `Status: ${roster?.status || 'DRAFT'}`, `Strategy: ${roster?.strategy || 'BALANCED'}`]);
  rows.push([]);

  if (viewType === 'company' || viewType === 'pod' || viewType === 'employee') {
    const isPod = viewType === 'pod';
    const header = [
      ...(isPod ? ['Pod'] : []),
      'Employee',
      'Role',
      'Preferred Off',
      'Working Days',
      'Weekly Offs',
      'Leaves/CO',
      'Holidays',
      ...dateHeaders,
    ];
    rows.push(header);

    const dailyWorkingTotals = new Array(dates.length).fill(0);

    const pushEmployeeRow = (emp, empEntryMap, podName = null) => {
      const empId = (emp._id || emp).toString();
      const { cells, w, wo, leave, hol } = summarizeEmployeeRow(empId, dates, empEntryMap);
      cells.forEach((code, idx) => {
        if (code === 'W') dailyWorkingTotals[idx]++;
      });

      rows.push([
        ...(isPod ? [podName] : []),
        emp.name,
        emp.isPodLead ? 'Pod Lead' : 'Specialist',
        (emp.weeklyOffPreference || []).join(' / '),
        w,
        wo,
        leave,
        hol,
        ...cells,
      ]);
    };

    if (viewType === 'company') {
      const entryMap = buildEntryLookup(viewData?.entries || []);
      for (const emp of viewData?.employees || []) {
        pushEmployeeRow(emp, entryMap);
      }
    } else if (viewType === 'pod') {
      const entryMap = buildEntryLookup(viewData?.entries || []);
      for (const group of viewData?.podGroups || []) {
        const podName = group.pod?.name || 'Pod';
        for (const emp of group.employees || []) {
          pushEmployeeRow(emp, entryMap, podName);
        }
      }
    } else if (viewType === 'employee') {
      for (const item of viewData?.employeeStats || []) {
        const empEntryMap = buildEntryLookup(item.entries || []);
        pushEmployeeRow(item.employee, empEntryMap);
      }
    }

    rows.push([
      ...(isPod ? [''] : []),
      'Daily Active Working Total',
      '',
      '',
      '',
      '',
      '',
      '',
      ...dailyWorkingTotals,
    ]);
  } else if (viewType === 'brand') {
    const entryMap = buildEntryLookup(viewData?.entries || []);
    rows.push(['Brand', 'Row Type', 'Process / Employee', 'Min Staff / Pref', ...dateHeaders]);

    for (const group of viewData?.brandGroups || []) {
      const brandName = group.brand?.name || 'Brand';
      for (const proc of group.processes || []) {
        const pId = proc._id.toString();
        const covCells = dates.map((dStr) => {
          const cov = coverageMap[`${pId}:${dStr}`];
          if (!cov || !cov.worksToday) return '-';
          return cov.isSufficient
            ? `${cov.workingCount}/${cov.minStaff}`
            : `${cov.workingCount}/${cov.minStaff} GAP`;
        });
        rows.push([brandName, 'Process Coverage', proc.type, `min ${proc.minStaffDefault}`, ...covCells]);
      }

      for (const emp of group.employees || []) {
        const empId = emp._id.toString();
        const empCells = dates.map((dStr) => STATUS_CODE[entryMap.get(`${empId}:${dStr}`) || 'WORKING'] || 'W');
        rows.push([
          brandName,
          'Assigned Staff',
          emp.name,
          (emp.weeklyOffPreference || []).join(' / '),
          ...empCells,
        ]);
      }
    }
  } else if (viewType === 'process') {
    rows.push(['Process Type', 'Process ID / Brand', 'Calendar Rule', 'Min Staff', ...dateHeaders]);

    for (const group of viewData?.processGroups || []) {
      for (const proc of group.processes || []) {
        const pId = proc._id.toString();
        const brandLabel = proc.brandId?.name || proc.name || pId;
        const covCells = dates.map((dStr) => {
          const cov = coverageMap[`${pId}:${dStr}`];
          if (!cov || !cov.worksToday) return '-';
          return cov.isSufficient
            ? `${cov.workingCount}/${cov.minStaff}`
            : `${cov.workingCount}/${cov.minStaff} GAP`;
        });
        rows.push([
          group.type,
          brandLabel,
          proc.calendarRule?.type || '',
          proc.minStaffDefault,
          ...covCells,
        ]);
      }
    }
  }

  if (conflicts.length > 0) {
    rows.push([]);
    rows.push(['CONFLICTS & ALERTS SUMMARY']);
    rows.push(['Severity', 'Date', 'Type', 'Message']);
    for (const c of conflicts) {
      rows.push([c.severity, c.date, c.type, c.message]);
    }
  }

  const csvBody = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csvBody}`], { type: 'text/csv;charset=utf-8;' });
  const filename = `RosterIQ_${monthLabel}_${viewType}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return filename;
}

