import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { StatusBadge } from './StatusBadge.jsx';
import { Badge } from '../../components/ui/Badge.jsx';

export function RosterAgenda({
  viewData = {},
  onCellClick,
  selectedDate: propDate,
}) {
  const dates = viewData.dates || [];
  const entries = viewData.entries || [];
  const coverageMap = viewData.coverageMap || {};
  const brandGroups = viewData.brandGroups || [];

  const [currentIndex, setCurrentIndex] = useState(0);

  const currentDate = propDate || dates[currentIndex] || dates[0] || '2025-12-01';
  const effectiveIndex = dates.indexOf(currentDate) !== -1 ? dates.indexOf(currentDate) : currentIndex;

  const handlePrev = () => {
    if (effectiveIndex > 0) setCurrentIndex(effectiveIndex - 1);
  };

  const handleNext = () => {
    if (effectiveIndex < dates.length - 1) setCurrentIndex(effectiveIndex + 1);
  };

  // Format header date
  const d = new Date(`${currentDate}T00:00:00.000Z`);
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getUTCDay()];
  const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Filter entries for this date
  const dateEntries = entries.filter((e) => (e.date || '').slice(0, 10) === currentDate);

  return (
    <div className="space-y-4">
      {/* Date Carousel Bar */}
      <div className="bg-elevated border border-hairline rounded-md p-3 flex items-center justify-between shadow-xs">
        <button
          type="button"
          onClick={handlePrev}
          disabled={effectiveIndex <= 0}
          className="touch-target p-2 rounded-sm text-body hover:bg-hairline-soft disabled:opacity-30 focus-ring cursor-pointer transition-colors"
          aria-label="Previous day"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <div className="text-xs font-mono uppercase text-mute tracking-wider">{weekday}</div>
          <div className="text-sm font-semibold text-ink flex items-center gap-1.5 justify-center">
            <Calendar className="w-3.5 h-3.5 text-mute" />
            <span>{formattedDate}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={effectiveIndex >= dates.length - 1}
          className="touch-target p-2 rounded-sm text-body hover:bg-hairline-soft disabled:opacity-30 focus-ring cursor-pointer transition-colors"
          aria-label="Next day"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Brand & Process Daily Cards */}
      <div className="space-y-3">
        {brandGroups.length > 0 ? (
          brandGroups.map((group) => {
            return (
              <div
                key={group.brand._id}
                className="bg-elevated border border-hairline rounded-md p-4 text-left shadow-xs space-y-3"
              >
                {/* Brand Header & Processes */}
                <div className="flex items-start justify-between border-b border-hairline pb-2.5">
                  <div>
                    <h4 className="text-sm font-semibold text-ink">{group.brand.name}</h4>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {group.processes.map((proc) => {
                        const cov = coverageMap[`${proc._id}:${currentDate}`] || {
                          worksToday: false,
                          workingCount: 0,
                          minStaff: 1,
                          isSufficient: true,
                        };

                        if (!cov.worksToday) {
                          return (
                            <span key={proc._id} className="text-[10px] text-faint">
                              {proc.type}: Off
                            </span>
                          );
                        }

                        return (
                          <span
                            key={proc._id}
                            className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded-xs border ${
                              cov.isSufficient
                                ? 'bg-success-soft text-success-deep border-success/20'
                                : 'bg-error-soft text-error-deep border-error/30 font-bold animate-pulse'
                            }`}
                          >
                            {proc.type}: {cov.workingCount}/{cov.minStaff}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Assigned Employees Status */}
                <div className="space-y-2">
                  <div className="text-[11px] font-mono text-mute uppercase">Assigned Staff</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {group.employees.map((emp) => {
                      const entry = dateEntries.find(
                        (e) => (e.employeeId?._id || e.employeeId)?.toString() === emp._id.toString()
                      );
                      const status = entry?.status || 'WORKING';

                      return (
                        <div
                          key={emp._id}
                          onClick={() => entry && onCellClick && onCellClick(entry)}
                          className="touch-target p-2.5 rounded-sm border border-hairline bg-canvas/40 hover:bg-hairline-soft/60 cursor-pointer flex items-center justify-between transition-colors"
                        >
                          <span className="text-xs font-medium text-ink truncate pr-2">
                            {emp.name}
                          </span>
                          <StatusBadge status={status} isCompact={false} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="divide-y divide-hairline bg-elevated border border-hairline rounded-md">
            {dateEntries.map((entry) => (
              <div
                key={entry._id}
                onClick={() => onCellClick && onCellClick(entry)}
                className="touch-target p-3 hover:bg-hairline-soft/30 cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-medium text-ink">
                    {entry.employeeId?.name || 'Staff Member'}
                  </div>
                  {entry.note && (
                    <div className="text-[10px] text-mute">{entry.note}</div>
                  )}
                </div>
                <StatusBadge status={entry.status} isCompact={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

