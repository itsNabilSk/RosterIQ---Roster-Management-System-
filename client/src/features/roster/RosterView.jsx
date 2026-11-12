import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../api/client.js';
import { RosterGrid } from './RosterGrid.jsx';
import { RosterAgenda } from './RosterAgenda.jsx';
import { ConflictPanel } from './ConflictPanel.jsx';
import { CellEditorModal } from './CellEditorModal.jsx';
import { BackupModal } from './BackupModal.jsx';
import { PublishModal } from './PublishModal.jsx';
import { ComparePlansModal } from './ComparePlansModal.jsx';
import { exportRosterToCsv } from './exportRosterCsv.js';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import {
  Calendar,
  Sparkles,
  LayoutGrid,
  CalendarDays,
  Send,
  RotateCcw,
  Building2,
  Users,
  Layers,
  UserCheck,
  GitCompare,
  Download,
} from 'lucide-react';

const STRATEGY_LABELS = {
  BALANCED: 'Balanced',
  FAIR_DISTRIBUTION: 'Fair Distribution',
  PREFERENCE_FIRST: 'Preference-First',
  OPERATIONS_FIRST: 'Coverage-First',
};

export function RosterView() {
  const { addToast } = useToast();

  const [month, setMonth] = useState(12);
  const [year, setYear] = useState(2025);
  const [viewType, setViewType] = useState('company'); // 'company' | 'pod' | 'brand' | 'process' | 'employee'
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' | 'agenda'

  const [roster, setRoster] = useState(null);
  const [viewData, setViewData] = useState({});
  const [conflicts, setConflicts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Modals state
  const [editingEntry, setEditingEntry] = useState(null);
  const [activeBackupConflict, setActiveBackupConflict] = useState(null);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
  const [comparisonData, setComparisonData] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  const [applyingStrategy, setApplyingStrategy] = useState(null);
  const [highlightedCell, setHighlightedCell] = useState({ date: null, empId: null });

  // Load existing roster and view data
  const loadRoster = useCallback(
    async (m = month, y = year, vType = viewType) => {
      setIsLoading(true);
      try {
        const found = await api.findRoster(m, y);
        if (found && found.roster) {
          setRoster(found.roster);
          setConflicts(found.conflicts || []);

          // Load specific view data
          const vData = await api.getRosterView(found.roster._id, vType);
          setViewData(vData);
        } else {
          setRoster(null);
          setViewData({});
          setConflicts([]);
        }
      } catch (err) {
        addToast({ message: err.message || 'Failed to load roster', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    },
    [month, year, viewType, addToast]
  );

  useEffect(() => {
    loadRoster(month, year, viewType);
  }, [month, year, viewType, loadRoster]);

  // Generate Roster
  const handleGenerate = async (strategy = 'BALANCED') => {
    setIsGenerating(true);
    try {
      const data = await api.generateRoster(month, year, strategy);
      addToast({
        message: `Roster generated (${STRATEGY_LABELS[strategy] || strategy}): ${data.entriesCount} shifts scheduled with ${data.summary.totalConflicts} constraint alerts.`,
        type: data.summary.errors > 0 ? 'warning' : 'success',
      });
      await loadRoster(month, year, viewType);
    } catch (err) {
      addToast({ message: err.message || 'Generation failed', type: 'error' });
    } finally {
      setIsGenerating(false);
    }
  };

  // Compare Alternative Plans (dry-run simulation)
  const handleOpenCompare = async () => {
    setIsCompareModalOpen(true);
    setIsComparing(true);
    try {
      const data = await api.compareRosterPlans(month, year);
      setComparisonData(data);
    } catch (err) {
      addToast({ message: err.message || 'Failed to compare plans', type: 'error' });
    } finally {
      setIsComparing(false);
    }
  };

  // Apply selected strategy from Compare Plans modal
  const handleApplyPlan = async (strategy) => {
    setApplyingStrategy(strategy);
    try {
      const data = await api.generateRoster(month, year, strategy);
      addToast({
        message: `Applied "${STRATEGY_LABELS[strategy] || strategy}" plan: ${data.entriesCount} shifts scheduled with ${data.summary.totalConflicts} alert(s).`,
        type: data.summary.errors > 0 ? 'warning' : 'success',
      });
      setIsCompareModalOpen(false);
      await loadRoster(month, year, viewType);
    } catch (err) {
      addToast({ message: err.message || 'Failed to apply plan', type: 'error' });
    } finally {
      setApplyingStrategy(null);
    }
  };

  // Export active roster view as CSV
  const handleExportCsv = () => {
    if (!roster) return;
    try {
      const filename = exportRosterToCsv({
        roster,
        viewType,
        viewData,
        conflicts,
        month,
        year,
      });
      addToast({ message: `Exported ${filename}`, type: 'success' });
    } catch (err) {
      addToast({ message: err.message || 'CSV export failed', type: 'error' });
    }
  };

  // Manual Cell Edit & Live Re-validate
  const handleSaveEntry = async (entryId, status, note) => {
    if (!roster) return;
    try {
      const result = await api.updateEntry(roster._id, entryId, status, note);
      setEditingEntry(null);
      setConflicts(result.conflicts || []);

      const { resolvedCount, introducedCount } = result.diff || {};
      let diffMsg = 'Shift updated successfully.';
      if (resolvedCount > 0 && introducedCount > 0) {
        diffMsg = `Resolved ${resolvedCount} conflict(s), but introduced ${introducedCount} new conflict(s).`;
      } else if (resolvedCount > 0) {
        diffMsg = `Conflict resolved! ${resolvedCount} error(s) cleared.`;
      } else if (introducedCount > 0) {
        diffMsg = `Warning: ${introducedCount} new conflict(s) introduced.`;
      }

      addToast({
        message: diffMsg,
        type: introducedCount > 0 ? 'warning' : 'success',
      });

      // Refresh view data to reflect updated entry
      const vData = await api.getRosterView(roster._id, viewType);
      setViewData(vData);
    } catch (err) {
      addToast({ message: err.message || 'Failed to update entry', type: 'error' });
    }
  };

  // Publish Roster
  const handlePublish = async (overrideReason) => {
    if (!roster) return;
    setIsPublishing(true);
    try {
      const data = await api.publishRoster(roster._id, overrideReason);
      addToast({ message: data.message, type: 'success' });
      setIsPublishModalOpen(false);
      await loadRoster(month, year, viewType);
    } catch (err) {
      addToast({ message: err.message || 'Failed to publish roster', type: 'error' });
    } finally {
      setIsPublishing(false);
    }
  };

  // Handle jump-to-conflict
  const handleSelectConflict = (conflict) => {
    setHighlightedCell({
      date: conflict.date,
      empId: conflict.employeeIds?.[0] || null,
    });
    // On mobile switch to agenda view for that date
    if (window.innerWidth < 768) {
      setLayoutMode('agenda');
    }
    addToast({
      message: `Navigated to ${conflict.date}: ${conflict.type.replace(/_/g, ' ')}`,
      type: 'info',
    });
  };

  const viewTabs = [
    { id: 'company', label: 'Company-Wide', icon: LayoutGrid },
    { id: 'pod', label: 'Pod-Wise', icon: Users },
    { id: 'brand', label: 'Brand-Wise', icon: Building2 },
    { id: 'process', label: 'Process-Wise', icon: Layers },
    { id: 'employee', label: 'Employee Stats', icon: UserCheck },
  ];

  return (
    <div className="space-y-6 text-left">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-elevated border border-hairline rounded-md p-4 shadow-xs">
        {/* Month Selector & View Type */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-canvas px-3 py-1.5 rounded-sm border border-hairline">
            <Calendar className="w-4 h-4 text-mute" />
            <select
              aria-label="Select month"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-semibold text-ink focus-ring cursor-pointer"
            >
              <option value={11}>November 2025</option>
              <option value={12}>December 2025</option>
              <option value={1}>January 2026</option>
            </select>
          </div>

          {/* Roster Status & Strategy Badges */}
          {roster && (
            <div className="flex items-center gap-1.5">
              <Badge
                variant={roster.status === 'PUBLISHED' ? 'success' : 'neutral'}
                size="md"
              >
                {roster.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'}
              </Badge>
              {roster.strategy && (
                <Badge variant="info" size="md">
                  {STRATEGY_LABELS[roster.strategy] || roster.strategy}
                </Badge>
              )}
            </div>
          )}

          {/* Desktop/Mobile Layout Toggle */}
          <div className="flex items-center border border-hairline rounded-sm overflow-hidden bg-canvas">
            <button
              type="button"
              onClick={() => setLayoutMode('grid')}
              className={`p-2 text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                layoutMode === 'grid'
                  ? 'bg-ink text-on-primary font-medium'
                  : 'text-body hover:bg-hairline-soft'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('agenda')}
              className={`p-2 text-xs flex items-center gap-1.5 cursor-pointer transition-colors ${
                layoutMode === 'agenda'
                  ? 'bg-ink text-on-primary font-medium'
                  : 'text-body hover:bg-hairline-soft'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Daily Agenda</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            disabled={isComparing || isGenerating}
            loading={isComparing}
            onClick={handleOpenCompare}
            icon={GitCompare}
          >
            Compare Plans
          </Button>

          {roster && (
            <Button
              variant="outline"
              onClick={handleExportCsv}
              icon={Download}
            >
              Export CSV
            </Button>
          )}

          <Button
            variant="secondary"
            disabled={isGenerating}
            loading={isGenerating}
            onClick={() => handleGenerate(roster?.strategy || 'BALANCED')}
            icon={isGenerating ? RotateCcw : Sparkles}
          >
            {isGenerating ? 'Generating...' : roster ? 'Regenerate' : 'Generate Roster'}
          </Button>

          {roster && (
            <Button
              variant={roster.status === 'PUBLISHED' ? 'secondary' : 'primary'}
              disabled={roster.status === 'PUBLISHED'}
              onClick={() => setIsPublishModalOpen(true)}
              icon={Send}
            >
              {roster.status === 'PUBLISHED' ? 'Published' : 'Publish Roster'}
            </Button>
          )}
        </div>
      </div>

      {/* 5 View Switcher Tabs */}
      <div className="border-b border-hairline flex items-center gap-1 overflow-x-auto scrollbar-subtle pb-px">
        {viewTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = viewType === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setViewType(tab.id)}
              className={`touch-target px-3.5 py-2 text-xs font-medium border-b-2 transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                isActive
                  ? 'border-ink text-ink font-semibold'
                  : 'border-transparent text-mute hover:text-ink hover:border-hairline'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Roster Display */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-mute bg-elevated border border-hairline rounded-md">
          Loading monthly schedule and operational matrix...
        </div>
      ) : !roster ? (
        <div className="p-16 text-center bg-elevated border border-hairline rounded-md space-y-4">
          <div className="w-12 h-12 rounded-full bg-canvas border border-hairline flex items-center justify-center mx-auto text-ink">
            <Calendar className="w-6 h-6 text-mute" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-ink">No Roster Generated Yet</h3>
            <p className="text-xs text-mute max-w-md mx-auto">
              Generate a deterministic monthly schedule that checks operating calendars,
              leaves, minimum staff requirements, and pod assignments.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="primary" onClick={() => handleGenerate('BALANCED')} icon={Sparkles}>
              Generate {month === 11 ? 'November 2025' : month === 1 ? 'January 2026' : 'December 2025'} Roster
            </Button>
            <Button variant="outline" onClick={handleOpenCompare} icon={GitCompare}>
              Compare Plans First
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Grid vs Agenda Layout */}
          {layoutMode === 'grid' ? (
            <RosterGrid
              viewType={viewType}
              viewData={viewData}
              onCellClick={(entry) => setEditingEntry(entry)}
              highlightedDate={highlightedCell.date}
              highlightedEmpId={highlightedCell.empId}
            />
          ) : (
            <RosterAgenda
              viewData={viewData}
              selectedDate={highlightedCell.date}
              onCellClick={(entry) => setEditingEntry(entry)}
            />
          )}

          {/* Conflict & Resolution Panel */}
          <ConflictPanel
            conflicts={conflicts}
            onSelectConflict={handleSelectConflict}
            onOpenBackupModal={(conflict) => setActiveBackupConflict(conflict)}
          />
        </div>
      )}

      {/* Modals */}
      <CellEditorModal
        isOpen={Boolean(editingEntry)}
        onClose={() => setEditingEntry(null)}
        entry={editingEntry}
        onSave={handleSaveEntry}
      />

      <BackupModal
        isOpen={Boolean(activeBackupConflict)}
        onClose={() => setActiveBackupConflict(null)}
        conflict={activeBackupConflict}
        rosterId={roster?._id}
        onBackupAssigned={() => loadRoster(month, year, viewType)}
      />

      <PublishModal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        conflicts={conflicts}
        onPublish={handlePublish}
        isPublishing={isPublishing}
      />

      <ComparePlansModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        month={month}
        year={year}
        comparisonData={comparisonData}
        isLoading={isComparing}
        applyingStrategy={applyingStrategy}
        onApplyPlan={handleApplyPlan}
      />
    </div>
  );
}

