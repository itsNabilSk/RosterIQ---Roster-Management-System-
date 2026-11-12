import React, { useRef, useEffect } from 'react';
import { StatusBadge } from './StatusBadge.jsx';
import { Check, ShieldAlert, Award } from 'lucide-react';

export function RosterGrid({
  viewType = 'company', // 'company' | 'pod' | 'brand' | 'process' | 'employee'
  viewData = {},
  onCellClick,
  highlightedDate = null,
  highlightedEmpId = null,
}) {
  const dates = viewData.dates || [];
  const entries = viewData.entries || [];
  const coverageMap = viewData.coverageMap || {};

  // Scroll Position Retention
  const scrollRef = useRef(null);
  const scrollPosRef = useRef({ left: 0, top: 0 });

  const handleScroll = () => {
    if (scrollRef.current) {
      scrollPosRef.current = {
        left: scrollRef.current.scrollLeft,
        top: scrollRef.current.scrollTop,
      };
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollPosRef.current.left;
      scrollRef.current.scrollTop = scrollPosRef.current.top;
    }
  }, [viewData]);

  // Fast map: `${employeeId}:${dateStr}` -> entry
  const entryMap = new Map();
  for (const e of entries) {
    const empId = (e.employeeId?._id || e.employeeId)?.toString();
    const dateStr = (e.date || '').slice(0, 10);
    entryMap.set(`${empId}:${dateStr}`, e);
  }

  // Format date header: day number + short weekday
  const formatDateHeader = (dStr) => {
    const d = new Date(`${dStr}T00:00:00.000Z`);
    const day = d.getUTCDate();
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()];
    const isWeekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    return { day, weekday, isWeekend };
  };

  return (
    <div className="relative w-full overflow-hidden border border-hairline rounded-md bg-elevated shadow-xs">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="overflow-x-auto overflow-y-auto max-h-[680px] scrollbar-subtle"
      >
        <table className="w-full text-left border-collapse text-xs select-none">
          {/* Table Header: Dates */}
          <thead>
            <tr className="bg-canvas border-b border-hairline sticky top-0 z-30">
              <th
                scope="col"
                className="p-3 font-semibold text-ink uppercase tracking-wider text-[11px] min-w-[200px] sticky top-0 left-0 z-40 bg-canvas border-r border-hairline shadow-[1px_0_0_0_var(--color-hairline)]"
              >
                {viewType === 'brand'
                  ? 'Brand / Process'
                  : viewType === 'pod'
                  ? 'Pod / Employee'
                  : viewType === 'process'
                  ? 'Process / Role'
                  : viewType === 'employee'
                  ? 'Employee'
                  : 'Employee'}
              </th>
              {dates.map((dStr) => {
                const { day, weekday, isWeekend } = formatDateHeader(dStr);
                const isHighlighted = highlightedDate === dStr;

                return (
                  <th
                    key={dStr}
                    scope="col"
                    className={`p-1.5 text-center min-w-[42px] max-w-[48px] border-r border-hairline transition-colors ${
                      isHighlighted
                        ? 'bg-link-soft text-link-deep font-bold'
                        : isWeekend
                        ? 'bg-hairline-soft/60 text-mute'
                        : 'text-body font-medium'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-mono">{weekday}</div>
                    <div className="text-xs font-semibold text-ink">{day}</div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body based on viewType */}
          <tbody className="divide-y divide-hairline">
            {/* VIEW 1: COMPANY-WIDE */}
            {viewType === 'company' &&
              (viewData.employees || []).map((emp) => {
                const empId = emp._id.toString();
                const isEmpHighlighted = highlightedEmpId === empId;

                return (
                  <tr
                    key={empId}
                    className={`hover:bg-hairline-soft/30 transition-colors ${
                      isEmpHighlighted ? 'bg-link-soft/20' : ''
                    }`}
                  >
                    <th
                      scope="row"
                      className="p-2.5 font-medium text-ink sticky left-0 z-20 bg-elevated border-r border-hairline shadow-[1px_0_0_0_var(--color-hairline)] truncate max-w-[220px]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{emp.name}</span>
                        {emp.isPodLead && (
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded-xs bg-ink text-on-primary">
                            LEAD
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-mute font-normal truncate">
                        Prefers: {(emp.weeklyOffPreference || []).join(', ')}
                      </div>
                    </th>

                    {dates.map((dStr) => {
                      const entry = entryMap.get(`${empId}:${dStr}`);
                      const status = entry?.status || 'WORKING';
                      const isCellHighlighted = highlightedDate === dStr && highlightedEmpId === empId;

                      return (
                        <td
                          key={dStr}
                          onClick={() => entry && onCellClick && onCellClick(entry)}
                          className={`p-1 text-center border-r border-hairline cursor-pointer transition-colors ${
                            isCellHighlighted ? 'ring-2 ring-link ring-inset bg-link-soft/40' : ''
                          }`}
                        >
                          <StatusBadge status={status} isCompact={true} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

            {/* VIEW 2: POD-WISE */}
            {viewType === 'pod' &&
              (viewData.podGroups || []).map((group) => (
                <React.Fragment key={group.pod._id}>
                  {/* Pod Header Row */}
                  <tr className="bg-canvas/80 border-y border-hairline">
                    <td
                      colSpan={dates.length + 1}
                      className="p-2.5 font-semibold text-xs text-ink uppercase tracking-wider sticky left-0 z-10"
                    >
                      <div className="flex items-center gap-2">
                        <span>{group.pod.name}</span>
                        <span className="text-mute font-normal text-[11px] lowercase">
                          ({group.employees.length} members)
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Employees in Pod */}
                  {group.employees.map((emp) => {
                    const empId = emp._id.toString();

                    return (
                      <tr key={empId} className="hover:bg-hairline-soft/30 transition-colors">
                        <th
                          scope="row"
                          className="p-2.5 font-medium text-ink sticky left-0 z-20 bg-elevated border-r border-hairline pl-6 truncate max-w-[220px]"
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{emp.name}</span>
                            {emp.isPodLead && (
                              <span className="text-[9px] font-mono px-1 py-0.2 rounded-xs bg-ink text-on-primary">
                                LEAD
                              </span>
                            )}
                          </div>
                        </th>

                        {dates.map((dStr) => {
                          const entry = entryMap.get(`${empId}:${dStr}`);
                          const status = entry?.status || 'WORKING';

                          return (
                            <td
                              key={dStr}
                              onClick={() => entry && onCellClick && onCellClick(entry)}
                              className="p-1 text-center border-r border-hairline cursor-pointer"
                            >
                              <StatusBadge status={status} isCompact={true} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}

            {/* VIEW 3: BRAND-WISE (With Process Coverage Rows 2/2 green, 0/1 red) */}
            {viewType === 'brand' &&
              (viewData.brandGroups || []).map((group) => (
                <React.Fragment key={group.brand._id}>
                  {/* Brand Header */}
                  <tr className="bg-canvas/90 border-y border-hairline">
                    <td
                      colSpan={dates.length + 1}
                      className="p-2.5 font-semibold text-xs text-ink uppercase tracking-wider sticky left-0 z-10"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{group.brand.name}</span>
                        <span className="text-[10px] text-mute lowercase">
                          {group.processes.length} processes
                        </span>
                      </div>
                    </td>
                  </tr>

                  {/* Processes under this Brand with Coverage Row */}
                  {group.processes.map((proc) => {
                    const pId = proc._id.toString();

                    return (
                      <tr key={pId} className="bg-elevated/40 hover:bg-hairline-soft/20">
                        <th
                          scope="row"
                          className="p-2 font-mono text-[11px] text-body sticky left-0 z-20 bg-elevated border-r border-hairline pl-5 flex items-center justify-between"
                        >
                          <span className="font-semibold text-ink">{proc.type}</span>
                          <span className="text-[10px] text-mute uppercase">
                            min: {proc.minStaffDefault}
                          </span>
                        </th>

                        {/* Coverage Row per Date */}
                        {dates.map((dStr) => {
                          const cov = coverageMap[`${pId}:${dStr}`] || {
                            worksToday: false,
                            workingCount: 0,
                            minStaff: 0,
                            isSufficient: true,
                          };

                          if (!cov.worksToday) {
                            return (
                              <td
                                key={dStr}
                                className="p-1 text-center border-r border-hairline bg-canvas/30 text-[10px] text-faint font-mono"
                                title="Process closed today"
                              >
                                —
                              </td>
                            );
                          }

                          return (
                            <td
                              key={dStr}
                              className={`p-1 text-center border-r border-hairline font-mono font-bold text-[11px] ${
                                cov.isSufficient
                                  ? 'text-success-deep bg-success-soft/30'
                                  : 'text-error bg-error-soft/60 animate-pulse'
                              }`}
                              title={`${cov.workingCount}/${cov.minStaff} staffed`}
                            >
                              {cov.workingCount}/{cov.minStaff}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {/* Employees assigned to this Brand */}
                  {group.employees.map((emp) => {
                    const empId = emp._id.toString();

                    return (
                      <tr key={empId} className="hover:bg-hairline-soft/30 transition-colors">
                        <th
                          scope="row"
                          className="p-2 font-medium text-xs text-ink sticky left-0 z-20 bg-elevated border-r border-hairline pl-8 truncate"
                        >
                          {emp.name}
                        </th>
                        {dates.map((dStr) => {
                          const entry = entryMap.get(`${empId}:${dStr}`);
                          const status = entry?.status || 'WORKING';

                          return (
                            <td
                              key={dStr}
                              onClick={() => entry && onCellClick && onCellClick(entry)}
                              className="p-1 text-center border-r border-hairline cursor-pointer"
                            >
                              <StatusBadge status={status} isCompact={true} />
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}

            {/* VIEW 4: PROCESS-WISE */}
            {viewType === 'process' &&
              (viewData.processGroups || []).map((group) => (
                <React.Fragment key={group.type}>
                  <tr className="bg-canvas border-y border-hairline">
                    <td
                      colSpan={dates.length + 1}
                      className="p-2 font-semibold text-xs text-ink uppercase tracking-wider sticky left-0 z-10"
                    >
                      {group.type} Processes ({group.processes.length} Brands)
                    </td>
                  </tr>

                  {group.processes.map((proc) => {
                    const pId = proc._id.toString();
                    const brandName = proc.brandId?.name || 'Brand';

                    return (
                      <tr key={pId} className="hover:bg-hairline-soft/20">
                        <th
                          scope="row"
                          className="p-2.5 font-medium text-xs text-ink sticky left-0 z-20 bg-elevated border-r border-hairline pl-6"
                        >
                          <div>{brandName}</div>
                          <div className="text-[10px] text-mute font-mono">
                            Rule: {proc.calendarRule?.type}
                          </div>
                        </th>

                        {dates.map((dStr) => {
                          const cov = coverageMap[`${pId}:${dStr}`] || {
                            worksToday: false,
                            workingCount: 0,
                            minStaff: 0,
                            isSufficient: true,
                          };

                          if (!cov.worksToday) {
                            return (
                              <td
                                key={dStr}
                                className="p-1 text-center border-r border-hairline bg-canvas/30 text-[10px] text-faint font-mono"
                              >
                                —
                              </td>
                            );
                          }

                          return (
                            <td
                              key={dStr}
                              className={`p-1 text-center border-r border-hairline font-mono font-bold text-[11px] ${
                                cov.isSufficient
                                  ? 'text-success-deep bg-success-soft/30'
                                  : 'text-error bg-error-soft/60'
                              }`}
                            >
                              {cov.workingCount}/{cov.minStaff}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}

            {/* VIEW 5: EMPLOYEE-WISE (Monthly Summary Stats) */}
            {viewType === 'employee' &&
              (viewData.employeeStats || []).map((item) => {
                const emp = item.employee;
                const stats = item.stats;

                return (
                  <tr key={emp._id} className="hover:bg-hairline-soft/30 transition-colors">
                    <th
                      scope="row"
                      className="p-2.5 font-medium text-xs text-ink sticky left-0 z-20 bg-elevated border-r border-hairline truncate"
                    >
                      <div className="font-semibold">{emp.name}</div>
                      <div className="text-[10px] text-mute flex items-center gap-2 mt-0.5">
                        <span className="text-success-deep font-semibold">
                          {stats.workingDays} W
                        </span>
                        <span>·</span>
                        <span>{stats.weeklyOffs} WO</span>
                        <span>·</span>
                        <span>{stats.leavesCount} L</span>
                      </div>
                    </th>

                    {dates.map((dStr) => {
                      const entry = entryMap.get(`${emp._id}:${dStr}`);
                      const status = entry?.status || 'WORKING';

                      return (
                        <td
                          key={dStr}
                          onClick={() => entry && onCellClick && onCellClick(entry)}
                          className="p-1 text-center border-r border-hairline cursor-pointer"
                        >
                          <StatusBadge status={status} isCompact={true} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

