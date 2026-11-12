import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ShieldAlert, CheckCircle2 } from 'lucide-react';

export function PublishModal({
  isOpen,
  onClose,
  conflicts = [],
  onPublish,
  isPublishing = false,
}) {
  const [overrideReason, setOverrideReason] = useState('');
  const errors = conflicts.filter((c) => c.severity === 'ERROR');
  const hasErrors = errors.length > 0;

  const handleConfirm = (e) => {
    e.preventDefault();
    if (hasErrors && !overrideReason.trim()) return;
    onPublish(overrideReason);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Publish Monthly Roster"
      description="Make schedule official and visible to all teams"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        {hasErrors ? (
          <div className="space-y-3">
            <div className="p-3.5 rounded-sm bg-error-soft border border-error/20 text-error-deep text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <ShieldAlert className="w-4 h-4 text-error" />
                <span>Publish Blocked: {errors.length} Unresolved Errors</span>
              </div>
              <p>
                RosterIQ prevents generating silently invalid rosters. To proceed,
                a manager must supply a written override justification.
              </p>
            </div>

            <div className="space-y-1.5 text-left">
              <label htmlFor="override-reason" className="text-xs font-medium text-ink block">
                Manager Override Reason <span className="text-error">*</span>
              </label>
              <textarea
                id="override-reason"
                required
                rows={3}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Approved by Operations VP; external contractor will handle Alpha CS coverage."
                className="w-full p-2.5 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring resize-none placeholder:text-faint"
              />
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-sm bg-success-soft border border-success/20 text-success-deep text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-success" />
              <span>Clean Roster Verified</span>
            </div>
            <p>
              Zero blocking errors found. All minimum staff levels and operating calendar rules are satisfied.
            </p>
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-2 border-t border-hairline">
          <Button variant="secondary" onClick={onClose} disabled={isPublishing}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant={hasErrors ? 'danger' : 'primary'}
            disabled={isPublishing || (hasErrors && !overrideReason.trim())}
          >
            {isPublishing
              ? 'Publishing...'
              : hasErrors
              ? 'Override & Publish'
              : 'Confirm & Publish'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

