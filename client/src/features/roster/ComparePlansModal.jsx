import React, { useState, useEffect, useMemo } from 'react';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import {
  GitCompare,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  Check,
} from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function formatShortDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function MetricRow({ label, valA, valB, format = (v) => v, higherIsBetter = true }) {
  const numA = Number(valA);
  const numB = Number(valB);
  const aWins = higherIsBetter ? numA > numB : numA < numB;
  const bWins = higherIsBetter ? numB > numA : numB < numA;

  return (
    <tr className="border-b border-hairline/70 last:border-b-0">
      <td className="py-2.5 px-3 text-xs font-medium text-body">{label}</td>
      <td
        className={`py-2.5 px-3 text-xs font-mono text-right ${
          aWins ? 'text-success-deep font-semibold bg-success-soft/30' : 'text-ink'
        }`}
      >
        {format(valA)}
      </td>
      <td
        className={`py-2.5 px-3 text-xs font-mono text-right ${
          bWins ? 'text-success-deep font-semibold bg-success-soft/30' : 'text-ink'
        }`}
      >
        {format(valB)}
      </td>
    </tr>
  );
}

export function ComparePlansModal({
  isOpen,
  onClose,
  month,
  year,
  comparisonData,
  isLoading,
  applyingStrategy,
  onApplyPlan,
}) {
  const plans = comparisonData?.plans || [];
  const employeesSummary = comparisonData?.employeesSummary || [];
  const currentRoster = comparisonData?.currentRoster || null;

  const [planAId, setPlanAId] = useState('BALANCED');
  const [planBId, setPlanBId] = useState('FAIR_DISTRIBUTION');

  useEffect(() => {
    if (plans.length >= 2) {
      const currentStrat = currentRoster?.strategy || 'BALANCED';
      setPlanAId(plans.some((p) => p.strategy === currentStrat) ? currentStrat : plans[0].strategy);
      const alt =
        plans.find((p) => p.isRecommended && p.strategy !== currentStrat) ||
        plans.find((p) => p.strategy !== currentStrat) ||
        plans[1];
      setPlanBId(alt.strategy);
    }
  }, [plans, currentRoster]);

  const planA = useMemo(() => plans.find((p) => p.strategy === planAId) || plans[0], [plans, planAId]);
  const planB = useMemo(() => plans.find((p) => p.strategy === planBId) || plans[1] || plans[0], [plans, planBId]);

  // Compute employee-level weekly-off diffs between Plan A and Plan B
  const employeeDiffs = useMemo(() => {
    if (!planA || !planB) return [];
    const diffs = [];
    for (const emp of employeesSummary) {
      const offsA = [...(planA.offDaysByEmployee?.[emp._id] || [])].sort();
      const offsB = [...(planB.offDaysByEmployee?.[emp._id] || [])].sort();
      const same = offsA.length === offsB.length && offsA.every((d, i) => d === offsB[i]);
      if (!same) {
        const setA = new Set(offsA);
        const setB = new Set(offsB);
        diffs.push({
          employee: emp,
          onlyInA: offsA.filter((d) => !setB.has(d)),
          onlyInB: offsB.filter((d) => !setA.has(d)),
          offsA,
          offsB,
        });
      }
    }
    return diffs;
  }, [planA, planB, employeesSummary]);

  const maxDailyHeadcount = useMemo(() => {
    if (!planA || !planB) return 1;
    const allCounts = [
      ...(planA.dailyWorkingSeries || []).map((d) => d.workingCount),
      ...(planB.dailyWorkingSeries || []).map((d) => d.workingCount),
    ];
    return Math.max(1, ...allCounts);
  }, [planA, planB]);

  const monthLabel = `${MONTH_NAMES[(month - 1) % 12] || ''} ${year}`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Compare Alternative Plans — ${monthLabel}`}
      description="Dry-run simulation across 4 scheduling strategies. Nothing in your live roster changes until you click Apply Plan."
      maxWidth="max-w-5xl"
    >
      {isLoading ? (
        <div className="py-14 text-center space-y-2">
          <GitCompare className="w-7 h-7 text-mute mx-auto animate-pulse" />
          <p className="text-xs font-medium text-ink">Simulating 4 scheduling strategies...</p>
          <p className="text-[11px] text-mute">Evaluating constraints, weekly-off fairness, and coverage spreads.</p>
        </div>
      ) : plans.length === 0 ? (
        <div className="py-10 text-center text-xs text-mute">
          No comparison data available. Try closing and reopening Compare Plans.
        </div>
      ) : (
        <div className="space-y-6">
          {currentRoster?.status === 'PUBLISHED' && (
            <div className="p-3 rounded-sm border border-warning/40 bg-warning-soft text-warning-deep text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This month&apos;s roster is currently <strong>PUBLISHED</strong>. Applying a new plan will overwrite shifts and reset its status to <strong>DRAFT</strong>.
              </span>
            </div>
          )}

          {/* 1. Strategy Cards Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {plans.map((plan) => {
              const isCurrent = currentRoster?.strategy === plan.strategy;
              const isApplyingThis = applyingStrategy === plan.strategy;
              const isSelectedForDiff = plan.strategy === planAId || plan.strategy === planBId;

              return (
                <div
                  key={plan.strategy}
                  className={`flex flex-col justify-between p-3.5 rounded-md border transition-colors ${
                    plan.isRecommended
                      ? 'border-ink bg-canvas/80 shadow-xs'
                      : isSelectedForDiff
                      ? 'border-link/50 bg-link-soft/15'
                      : 'border-hairline bg-elevated'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {plan.isRecommended && (
                        <Badge variant="info" size="sm" icon={Sparkles}>
                          Recommended
                        </Badge>
                      )}
                      {isCurrent && (
                        <Badge variant="success" size="sm" icon={Check}>
                          Active
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h3 className="text-xs font-semibold text-ink">{plan.shortLabel}</h3>
                      <p className="text-[11px] text-mute mt-1 leading-relaxed">{plan.description}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-hairline/70 text-[11px]">
                      <div>
                        <span className="text-mute block">Coverage</span>
                        <span className="font-mono font-semibold text-ink">{plan.metrics.coverageRate}%</span>
                      </div>
                      <div>
                        <span className="text-mute block">Pref Match</span>
                        <span className="font-mono font-semibold text-ink">{plan.metrics.preferenceMatchRate}%</span>
                      </div>
                      <div>
                        <span className="text-mute block">Errors / Warn</span>
                        <span className="font-mono font-semibold text-ink">
                          <span className={plan.metrics.errorCount > 0 ? 'text-error-deep' : 'text-success-deep'}>
                            {plan.metrics.errorCount}
                          </span>
                          {' / '}
                          <span className={plan.metrics.warningCount > 0 ? 'text-warning-deep' : 'text-ink'}>
                            {plan.metrics.warningCount}
                          </span>
                        </span>
                      </div>
                      <div>
                        <span className="text-mute block">Daily Staff</span>
                        <span className="font-mono font-semibold text-ink">
                          {plan.metrics.dailyMinWorking}–{plan.metrics.dailyMaxWorking}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-hairline/70 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setPlanAId(plan.strategy)}
                        className={`flex-1 py-1 px-2 rounded-sm text-[11px] font-medium border transition-colors cursor-pointer ${
                          planAId === plan.strategy
                            ? 'bg-ink text-on-primary border-ink'
                            : 'bg-canvas text-body border-hairline hover:bg-hairline-soft'
                        }`}
                      >
                        Compare A
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlanBId(plan.strategy)}
                        className={`flex-1 py-1 px-2 rounded-sm text-[11px] font-medium border transition-colors cursor-pointer ${
                          planBId === plan.strategy
                            ? 'bg-link text-on-primary border-link'
                            : 'bg-canvas text-body border-hairline hover:bg-hairline-soft'
                        }`}
                      >
                        Compare B
                      </button>
                    </div>

                    <Button
                      variant={plan.isRecommended ? 'primary' : 'outline'}
                      className="w-full"
                      loading={isApplyingThis}
                      disabled={Boolean(applyingStrategy)}
                      onClick={() => onApplyPlan(plan.strategy)}
                      icon={CheckCircle2}
                    >
                      {isApplyingThis ? 'Applying...' : isCurrent ? 'Re-Apply Plan' : 'Apply Plan'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 2. Side-by-Side Comparison Matrix */}
          {planA && planB && (
            <div className="border border-hairline rounded-md overflow-hidden bg-elevated">
              <div className="p-3 bg-canvas/70 border-b border-hairline flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4 text-ink" />
                  <h4 className="text-xs font-semibold text-ink">Side-by-Side Trade-Off Matrix</h4>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs bg-ink" />
                    <select
                      aria-label="Select Plan A"
                      value={planAId}
                      onChange={(e) => setPlanAId(e.target.value)}
                      className="bg-elevated border border-hairline rounded-sm px-2 py-1 text-xs font-medium text-ink focus-ring cursor-pointer"
                    >
                      {plans.map((p) => (
                        <option key={p.strategy} value={p.strategy}>
                          Plan A: {p.shortLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-mute">vs</span>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block w-2.5 h-2.5 rounded-xs bg-link" />
                    <select
                      aria-label="Select Plan B"
                      value={planBId}
                      onChange={(e) => setPlanBId(e.target.value)}
                      className="bg-elevated border border-hairline rounded-sm px-2 py-1 text-xs font-medium text-ink focus-ring cursor-pointer"
                    >
                      {plans.map((p) => (
                        <option key={p.strategy} value={p.strategy}>
                          Plan B: {p.shortLabel}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-hairline bg-canvas/40 text-[11px] font-mono uppercase text-mute">
                      <th className="py-2 px-3">Evaluation Metric</th>
                      <th className="py-2 px-3 text-right">Plan A: {planA.shortLabel}</th>
                      <th className="py-2 px-3 text-right">Plan B: {planB.shortLabel}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <MetricRow
                      label="Process Coverage Rate"
                      valA={planA.metrics.coverageRate}
                      valB={planB.metrics.coverageRate}
                      format={(v) => `${v}%`}
                      higherIsBetter={true}
                    />
                    <MetricRow
                      label="Weekly-Off Preference Match"
                      valA={planA.metrics.preferenceMatchRate}
                      valB={planB.metrics.preferenceMatchRate}
                      format={(v) => `${v}%`}
                      higherIsBetter={true}
                    />
                    <MetricRow
                      label="Hard Conflicts (ERROR)"
                      valA={planA.metrics.errorCount}
                      valB={planB.metrics.errorCount}
                      higherIsBetter={false}
                    />
                    <MetricRow
                      label="Soft Alerts (WARNING)"
                      valA={planA.metrics.warningCount}
                      valB={planB.metrics.warningCount}
                      higherIsBetter={false}
                    />
                    <MetricRow
                      label="Daily Staffing Spread (Max - Min)"
                      valA={planA.metrics.dailyHeadcountSpread}
                      valB={planB.metrics.dailyHeadcountSpread}
                      format={(v) => `${v} staff`}
                      higherIsBetter={false}
                    />
                    <MetricRow
                      label="Daily Staffing Volatility (Std Dev)"
                      valA={planA.metrics.dailyHeadcountStdDev}
                      valB={planB.metrics.dailyHeadcountStdDev}
                      higherIsBetter={false}
                    />
                    <MetricRow
                      label="Employees with Weekend Off (Sat/Sun)"
                      valA={planA.metrics.weekendOffEmployees}
                      valB={planB.metrics.weekendOffEmployees}
                      higherIsBetter={true}
                    />
                    <MetricRow
                      label="Missed Weekly Off Weeks"
                      valA={planA.metrics.noWeeklyOffWarnings}
                      valB={planB.metrics.noWeeklyOffWarnings}
                      higherIsBetter={false}
                    />
                    <MetricRow
                      label="Total Working Shifts"
                      valA={planA.metrics.workingDays}
                      valB={planB.metrics.workingDays}
                      higherIsBetter={true}
                    />
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Daily Headcount Comparison Chart */}
          {planA && planB && (
            <div className="border border-hairline rounded-md p-3.5 bg-elevated space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold text-ink">Daily Active Headcount Curve</h4>
                  <p className="text-[11px] text-mute">
                    Compare daily staff availability across {monthLabel} (flatter curve = smoother coverage).
                  </p>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-body">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-ink inline-block" />
                    {planA.shortLabel}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-link inline-block" />
                    {planB.shortLabel}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto pb-1">
                <div className="min-w-[540px] flex items-end gap-1 h-24 pt-2 border-b border-hairline">
                  {planA.dailyWorkingSeries.map((dayA, idx) => {
                    const dayB = planB.dailyWorkingSeries[idx] || dayA;
                    const hA = Math.round((dayA.workingCount / maxDailyHeadcount) * 100);
                    const hB = Math.round((dayB.workingCount / maxDailyHeadcount) * 100);
                    const dayNum = dayA.date.slice(-2);

                    return (
                      <div
                        key={dayA.date}
                        title={`${dayA.date}: ${planA.shortLabel} = ${dayA.workingCount} working | ${planB.shortLabel} = ${dayB.workingCount} working`}
                        className="flex-1 flex flex-col items-center justify-end h-full gap-0.5 group"
                      >
                        <div className="w-full flex items-end justify-center gap-px h-full">
                          <div
                            style={{ height: `${hA}%` }}
                            className="w-1.5 bg-ink/80 group-hover:bg-ink rounded-t-xs transition-all"
                          />
                          <div
                            style={{ height: `${hB}%` }}
                            className="w-1.5 bg-link/75 group-hover:bg-link rounded-t-xs transition-all"
                          />
                        </div>
                        <span className="text-[9px] font-mono text-mute">{dayNum}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 4. Shift-by-Shift Off-Day Diff Inspector */}
          {planA && planB && (
            <div className="border border-hairline rounded-md bg-elevated overflow-hidden">
              <div className="p-3 bg-canvas/70 border-b border-hairline flex items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-semibold text-ink">
                    Employee Off-Day Differences ({employeeDiffs.length})
                  </h4>
                  <p className="text-[11px] text-mute">
                    Showing employees whose scheduled Weekly Off dates differ between {planA.shortLabel} and {planB.shortLabel}.
                  </p>
                </div>
                {planA.metrics.errorCount === 0 ? (
                  <Badge variant="success" size="sm" icon={CheckCircle2}>
                    0 Hard Errors
                  </Badge>
                ) : (
                  <Badge variant="error" size="sm" icon={AlertCircle}>
                    {planA.metrics.errorCount} / {planB.metrics.errorCount} Errors
                  </Badge>
                )}
              </div>

              {employeeDiffs.length === 0 ? (
                <div className="p-5 text-center text-xs text-mute">
                  No off-day differences between <strong>{planA.shortLabel}</strong> and{' '}
                  <strong>{planB.shortLabel}</strong> — hard coverage constraints lock the same weekly offs for this dataset.
                </div>
              ) : (
                <div className="divide-y divide-hairline max-h-60 overflow-y-auto scrollbar-subtle">
                  {employeeDiffs.map(({ employee, onlyInA, onlyInB }) => (
                    <div
                      key={employee._id}
                      className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-ink">{employee.name}</span>
                        <span className="text-[11px] text-mute ml-2">
                          Pref: {(employee.weeklyOffPreference || []).join(', ')}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                        <div className="flex flex-wrap items-center gap-1">
                          {onlyInA.map((d) => (
                            <span
                              key={d}
                              className="px-1.5 py-0.5 rounded-sm bg-hairline-soft border border-hairline text-body"
                            >
                              {formatShortDate(d)}
                            </span>
                          ))}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-mute shrink-0" />
                        <div className="flex flex-wrap items-center gap-1">
                          {onlyInB.map((d) => (
                            <span
                              key={d}
                              className="px-1.5 py-0.5 rounded-sm bg-link-soft/60 border border-link/30 text-link-deep font-medium"
                            >
                              {formatShortDate(d)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

