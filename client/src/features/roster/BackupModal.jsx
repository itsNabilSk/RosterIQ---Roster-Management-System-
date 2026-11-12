import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { api } from '../../api/client.js';
import { UserCheck, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function BackupModal({
  isOpen,
  onClose,
  conflict,
  rosterId,
  onBackupAssigned,
}) {
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSuggestions() {
      if (!conflict || !rosterId) return;
      setIsLoading(true);
      setError(null);
      try {
        const data = await api.getSuggestions(rosterId, {
          date: conflict.date,
          brandId: conflict.brandId,
          processId: conflict.processId,
          employeeIds: conflict.employeeIds,
        });
        setCandidates(data || []);
      } catch (err) {
        setError(err.message || 'Failed to load backup suggestions');
      } finally {
        setIsLoading(false);
      }
    }

    if (isOpen) {
      fetchSuggestions();
    }
  }, [isOpen, conflict, rosterId]);

  if (!conflict) return null;

  const handleAssign = async (employeeId) => {
    setIsAssigning(true);
    try {
      await api.assignBackup(rosterId, {
        employeeId,
        processId: conflict.processId,
        date: conflict.date,
      });
      if (onBackupAssigned) {
        onBackupAssigned();
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to assign backup');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Recommended Backup Employees"
      description={`Coverage gap on ${conflict.date}`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        {/* Conflict Summary Box */}
        <div className="p-3 rounded-sm bg-warning-soft/40 border border-warning/30 text-xs text-warning-deep space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Gap Summary</span>
          </div>
          <p>{conflict.message}</p>
        </div>

        {/* Candidate List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono uppercase text-mute">
            <span>Ranked Candidates</span>
            <span className="flex items-center gap-1 text-link font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Multi-Factor AI Ranking</span>
            </span>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-mute">
              Evaluating workload, pods, and availability...
            </div>
          ) : error ? (
            <div className="p-4 rounded-sm bg-error-soft text-error text-xs">
              {error}
            </div>
          ) : candidates.length === 0 ? (
            <div className="p-6 text-center text-xs text-mute">
              No available employees could be found without creating a secondary conflict.
            </div>
          ) : (
            candidates.map((cand, idx) => (
              <div
                key={cand.employeeId}
                className="p-3 sm:p-4 rounded-sm border border-hairline bg-elevated hover:bg-hairline-soft/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-ink text-on-primary text-[11px] font-bold flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <span className="font-semibold text-xs text-ink">{cand.name}</span>
                    <Badge variant="neutral" size="sm">
                      {cand.podName}
                    </Badge>
                  </div>
                  {/* Reasons Badges */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    {cand.reasons.map((r, rIdx) => (
                      <span
                        key={rIdx}
                        className="text-[10px] px-1.5 py-0.5 rounded-xs bg-canvas border border-hairline text-body"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={isAssigning}
                  onClick={() => handleAssign(cand.employeeId)}
                  className="shrink-0 self-start sm:self-center"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Assign Backup</span>
                </Button>
              </div>
            ))
          )}
        </div>

        <div className="pt-2 flex justify-end border-t border-hairline">
          <Button variant="secondary" onClick={onClose} disabled={isAssigning}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

