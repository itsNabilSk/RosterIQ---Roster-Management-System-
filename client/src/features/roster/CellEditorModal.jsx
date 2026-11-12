import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { STATUS_CONFIG } from './StatusBadge.jsx';

export function CellEditorModal({
  isOpen,
  onClose,
  entry,
  onSave,
  isSaving = false,
}) {
  const [selectedStatus, setSelectedStatus] = useState('WORKING');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (entry) {
      setSelectedStatus(entry.status || 'WORKING');
      setNote(entry.note || '');
    }
  }, [entry]);

  if (!entry) return null;

  const empName = entry.employeeId?.name || 'Employee';
  const dateStr = entry.date?.slice(0, 10);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(entry._id, selectedStatus, note);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Schedule Entry"
      description={`Update status for ${empName} on ${dateStr}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-body block">
            Select Shift Status
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATUS_CONFIG).map(([key, config]) => {
              const isSelected = selectedStatus === key;
              const Icon = config.icon;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedStatus(key)}
                  className={`touch-target p-2.5 rounded-sm border text-xs font-medium flex items-center gap-2 cursor-pointer transition-all ${
                    isSelected
                      ? `${config.bg} ${config.text} ${config.border} ring-2 ring-ink ring-offset-1`
                      : 'bg-elevated text-ink border-hairline hover:bg-hairline-soft'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <div className="text-left">
                    <div className="font-semibold">{config.code}</div>
                    <div className="text-[11px] opacity-80">{config.label}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="editor-note" className="text-xs font-medium text-body block">
            Shift Note (Optional)
          </label>
          <input
            id="editor-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Swapped with Priya, special coverage"
            className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink w-full focus-ring"
          />
        </div>

        <div className="pt-2 flex items-center justify-end gap-2 border-t border-hairline">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving}>
            {isSaving ? 'Updating...' : 'Save & Re-validate'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

