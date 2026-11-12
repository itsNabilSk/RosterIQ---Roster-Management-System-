import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import {
  RotateCcw,
  ShieldAlert,
  UserCheck,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Building2,
  AlertTriangle,
} from 'lucide-react';

export function DemoPage() {
  const { addToast } = useToast();
  const [demoStatus, setDemoStatus] = useState(null);
  const [rosterData, setRosterData] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const loadDemo = async () => {
    setIsLoading(true);
    try {
      const status = await api.getDemoStatus();
      setDemoStatus(status);

      // Find December 2025 roster
      const r = await api.findRoster(12, 2025);
      setRosterData(r);

      if (r && r.roster) {
        // Find Alpha CS conflict on Dec 1
        const alphaConflict = (r.conflicts || []).find(
          (c) => c.date === '2025-12-01' && (c.type === 'SPOF_RISK' || c.type === 'COVERAGE_GAP')
        );

        if (alphaConflict) {
          const suggs = await api.getSuggestions(r.roster._id, {
            date: '2025-12-01',
            brandId: alphaConflict.brandId,
            processId: alphaConflict.processId,
            employeeIds: alphaConflict.employeeIds,
          });
          setSuggestions(suggs || []);
        } else {
          setSuggestions([]);
        }
      }
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDemo();
  }, []);

  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      await api.resetDemo();
      addToast({ message: 'Demo environment reset to pristine state', type: 'success' });
      await loadDemo();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    } finally {
      setIsResetting(false);
    }
  };

  const handleOneClickResolve = async () => {
    if (!rosterData?.roster || suggestions.length === 0) return;
    setIsResolving(true);
    try {
      const topCandidate = suggestions[0];
      const alphaConflict = (rosterData.conflicts || []).find(
        (c) => c.date === '2025-12-01' && (c.type === 'SPOF_RISK' || c.type === 'COVERAGE_GAP')
      );

      if (!alphaConflict) {
        addToast({ message: 'Conflict is already resolved!', type: 'info' });
        return;
      }

      await api.assignBackup(rosterData.roster._id, {
        employeeId: topCandidate.employeeId,
        processId: alphaConflict.processId,
        date: '2025-12-01',
      });

      addToast({
        message: `Assigned ${topCandidate.name} as backup! Conflict resolved live.`,
        type: 'success',
      });
      await loadDemo();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    } finally {
      setIsResolving(false);
    }
  };

  const alphaConflicts = (rosterData?.conflicts || []).filter(
    (c) => c.date === '2025-12-01' && c.brandId === demoStatus?.alphaBrand?._id
  );
  const isAlphaResolved = alphaConflicts.length === 0;

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      {/* Demo Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-elevated border border-hairline rounded-md p-4 sm:p-6 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-ink">One-Click Assignment Demo Path</h2>
            <Badge variant="violet" size="sm">
              Live Interactive Walkthrough
            </Badge>
          </div>
          <p className="text-xs text-mute mt-1 max-w-xl">
            Demonstrates single-resource vulnerability detection, constraint validation,
            intelligent multi-factor backup recommendation, and real-time conflict resolution.
          </p>
        </div>

        <Button
          variant="secondary"
          disabled={isResetting}
          loading={isResetting}
          onClick={handleResetDemo}
          icon={RotateCcw}
        >
          {isResetting ? 'Resetting...' : 'Reset Demo State'}
        </Button>
      </div>

      {isLoading ? (
        <div className="p-16 text-center text-xs text-mute bg-elevated border border-hairline rounded-md">
          Loading demo scenario data...
        </div>
      ) : (
        <div className="space-y-6">
          {/* SCENARIO 1: Brand Alpha CS (Single-Resource) */}
          <div className="bg-elevated border border-hairline rounded-md p-5 space-y-5 shadow-xs">
            <div className="flex items-start justify-between border-b border-hairline pb-4">
              <div>
                <div className="text-xs font-mono uppercase text-mute tracking-wider">
                  Scenario 1 · Single-Resource Brand
                </div>
                <h3 className="text-base font-semibold text-ink flex items-center gap-2 mt-0.5">
                  <Building2 className="w-4 h-4 text-mute" />
                  <span>Brand "Alpha CS" (Rahul Sharma covers CS + ACC + NDR)</span>
                </h3>
              </div>

              <Badge variant={isAlphaResolved ? 'success' : 'error'} size="md">
                {isAlphaResolved ? 'Coverage Intact' : 'Coverage Gap Detected'}
              </Badge>
            </div>

            {/* Stepper Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Step 1: Absence */}
              <div className="p-4 rounded-sm bg-canvas border border-hairline space-y-2">
                <div className="text-[11px] font-mono uppercase text-mute font-medium">
                  1. Planned Absence
                </div>
                <div className="text-xs text-ink font-semibold">
                  Rahul Sharma on Leave
                </div>
                <p className="text-[11px] text-mute leading-relaxed">
                  Rahul has an approved leave on Monday, Dec 1, 2025. All 3 brand processes
                  (CS, ACC, NDR) operate on Mondays.
                </p>
                <Badge variant="warning" size="sm">
                  Dec 1 · Approved Leave
                </Badge>
              </div>

              {/* Step 2: System Detection */}
              <div className="p-4 rounded-sm bg-canvas border border-hairline space-y-2">
                <div className="text-[11px] font-mono uppercase text-mute font-medium">
                  2. Constraint Detection
                </div>
                <div className="text-xs font-semibold text-error flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{isAlphaResolved ? 'Resolved' : 'Immediate Conflicts'}</span>
                </div>
                <p className="text-[11px] text-mute leading-relaxed">
                  {isAlphaResolved
                    ? 'Backup specialist assigned. Roster validator re-evaluated to 0 blocking errors.'
                    : `SPOF_RISK & COVERAGE_GAP detected. 0/1 staff active for Brand Alpha CS on Dec 1.`}
                </p>
                <div className="flex flex-wrap gap-1">
                  <Badge variant={isAlphaResolved ? 'success' : 'error'} size="sm">
                    {isAlphaResolved ? 'Zero Blocking Errors' : 'SPOF_RISK (ERROR)'}
                  </Badge>
                </div>
              </div>

              {/* Step 3: Resolution */}
              <div className="p-4 rounded-sm bg-canvas border border-hairline space-y-2">
                <div className="text-[11px] font-mono uppercase text-mute font-medium">
                  3. Actionable Resolution
                </div>
                <div className="text-xs text-ink font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-link" />
                  <span>AI Backup Suggester</span>
                </div>
                <p className="text-[11px] text-mute leading-relaxed">
                  Ranked Ananya Iyer #1 because of Same Pod (Pod Titan), zero conflicting shifts,
                  and low weekly workload.
                </p>
                <Button
                  variant={isAlphaResolved ? 'secondary' : 'primary'}
                  size="sm"
                  disabled={isAlphaResolved || isResolving}
                  onClick={handleOneClickResolve}
                  className="w-full mt-2"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{isAlphaResolved ? 'Backup Already Assigned' : 'Assign Backup Live'}</span>
                </Button>
              </div>
            </div>

            {/* Candidates Recommendation Card */}
            {!isAlphaResolved && suggestions.length > 0 && (
              <div className="p-4 rounded-sm border border-link/30 bg-link-soft/20 space-y-3">
                <div className="text-xs font-semibold text-link-deep flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  <span>Top Ranked Candidate: {suggestions[0].name}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestions[0].reasons.map((r, i) => (
                    <Badge key={i} variant="neutral" size="sm">
                      {r}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* SCENARIO 2: Multi-Employee Brand Resilience */}
          <div className="bg-elevated border border-hairline rounded-md p-5 space-y-3 shadow-xs">
            <div className="flex items-start justify-between border-b border-hairline pb-3">
              <div>
                <div className="text-xs font-mono uppercase text-mute tracking-wider">
                  Scenario 2 · Multi-Employee Brand Resilience
                </div>
                <h3 className="text-base font-semibold text-ink flex items-center gap-2 mt-0.5">
                  <Building2 className="w-4 h-4 text-mute" />
                  <span>Brand "Beta Support" (3 Employees: Sanjay, Ritu, Harish)</span>
                </h3>
              </div>
              <Badge variant="success" size="md">
                Resilient · No Error
              </Badge>
            </div>

            <div className="p-4 rounded-sm bg-canvas border border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-semibold text-ink flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                  <span>Harish Pandey is on approved leave on Dec 1, but minStaff (2) is met!</span>
                </div>
                <p className="text-xs text-mute leading-relaxed max-w-2xl">
                  Beta Support operates 365 days with <code className="font-mono">minStaff: 2</code>.
                  Because Sanjay Chawla and Ritu Sen are both available, coverage is exactly 2/2.
                  The validator verifies this is fully compliant and emits 0 error conflicts.
                </p>
              </div>
              <div className="text-right shrink-0">
                <div className="font-mono text-base font-bold text-success-deep">2/2 Staffed</div>
                <span className="text-[10px] text-mute font-mono">Status: Green</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

