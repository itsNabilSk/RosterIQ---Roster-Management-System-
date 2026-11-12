import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, ArrowRight, UserCheck, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { Badge } from '../../components/ui/Badge.jsx';
import { Button } from '../../components/ui/Button.jsx';

export function ConflictPanel({
  conflicts = [],
  onSelectConflict,
  onOpenBackupModal,
}) {
  const [activeTab, setActiveTab] = useState('ALL'); // 'ALL' | 'ERROR' | 'WARNING'
  const [isExpanded, setIsExpanded] = useState(true);

  const errors = conflicts.filter((c) => c.severity === 'ERROR');
  const warnings = conflicts.filter((c) => c.severity === 'WARNING');

  const filteredConflicts =
    activeTab === 'ERROR'
      ? errors
      : activeTab === 'WARNING'
      ? warnings
      : conflicts;

  return (
    <div className="bg-elevated border border-hairline rounded-md overflow-hidden text-left shadow-xs">
      {/* Panel Header */}
      <div className="p-3 sm:p-4 border-b border-hairline flex items-center justify-between bg-canvas/40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {errors.length > 0 ? (
              <ShieldAlert className="w-4 h-4 text-error" />
            ) : (
              <CheckCircle className="w-4 h-4 text-success" />
            )}
            <h3 className="text-sm font-semibold text-ink">
              Roster Constraints & Conflicts
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            {errors.length > 0 && (
              <Badge variant="error" size="sm">
                {errors.length} {errors.length === 1 ? 'Error' : 'Errors'}
              </Badge>
            )}
            {warnings.length > 0 && (
              <Badge variant="warning" size="sm">
                {warnings.length} {warnings.length === 1 ? 'Warning' : 'Warnings'}
              </Badge>
            )}
            {conflicts.length === 0 && (
              <Badge variant="success" size="sm">
                Clean Roster
              </Badge>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse conflicts' : 'Expand conflicts'}
          className="p-1 rounded-sm text-mute hover:text-ink focus-ring transition-colors"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Tab Filter */}
          <div className="flex border-b border-hairline px-3 py-1.5 gap-2 text-xs bg-canvas/20">
            <button
              type="button"
              onClick={() => setActiveTab('ALL')}
              className={`px-2.5 py-1 rounded-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'ALL'
                  ? 'bg-ink text-on-primary'
                  : 'text-body hover:bg-hairline-soft'
              }`}
            >
              All ({conflicts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ERROR')}
              className={`px-2.5 py-1 rounded-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'ERROR'
                  ? 'bg-error text-white'
                  : 'text-body hover:bg-hairline-soft'
              }`}
            >
              Errors ({errors.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('WARNING')}
              className={`px-2.5 py-1 rounded-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'WARNING'
                  ? 'bg-warning text-white'
                  : 'text-body hover:bg-hairline-soft'
              }`}
            >
              Warnings ({warnings.length})
            </button>
          </div>

          {/* List of Conflicts */}
          <div className="max-h-80 overflow-y-auto scrollbar-subtle divide-y divide-hairline">
            {filteredConflicts.length === 0 ? (
              <div className="p-6 text-center text-xs text-mute space-y-1">
                <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" />
                <p className="font-medium text-ink">No conflicts detected in this filter.</p>
                <p>All hard operational constraints and coverage requirements are met.</p>
              </div>
            ) : (
              filteredConflicts.map((c, idx) => {
                const isError = c.severity === 'ERROR';
                const isCoverageGap = c.type === 'COVERAGE_GAP' || c.type === 'SPOF_RISK';

                return (
                  <div
                    key={`${c.type}-${c.date}-${idx}`}
                    className={`p-3.5 sm:p-4 hover:bg-hairline-soft/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isError ? 'border-l-3 border-l-error' : 'border-l-3 border-l-warning'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={isError ? 'error' : 'warning'} size="sm">
                          {c.type.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-xs font-mono font-medium text-ink">
                          {c.date}
                        </span>
                      </div>
                      <p className="text-xs text-body leading-relaxed">{c.message}</p>
                      {c.suggestions && c.suggestions.length > 0 && (
                        <p className="text-[11px] text-mute flex items-center gap-1 italic">
                          <span>Tip:</span> {c.suggestions[0]}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      {isCoverageGap && onOpenBackupModal && (
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={UserCheck}
                          onClick={() => onOpenBackupModal(c)}
                        >
                          Find Backup
                        </Button>
                      )}
                      {onSelectConflict && (
                        <button
                          type="button"
                          onClick={() => onSelectConflict(c)}
                          className="touch-target px-2.5 py-1 text-xs font-medium text-link hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>Jump to Cell</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

