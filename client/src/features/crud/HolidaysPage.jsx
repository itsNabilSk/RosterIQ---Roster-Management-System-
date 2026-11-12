import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Plus, Trash2, Award } from 'lucide-react';

export function HolidaysPage() {
  const { addToast } = useToast();
  const [holidays, setHolidays] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [date, setDate] = useState('2025-12-25');
  const [name, setName] = useState('');

  const loadHolidays = async () => {
    setIsLoading(true);
    try {
      const data = await api.getHolidays();
      setHolidays(data || []);
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createHoliday({ date, name });
      addToast({ message: 'Holiday created', type: 'success' });
      setIsModalOpen(false);
      setName('');
      loadHolidays();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this holiday?')) return;
    try {
      await api.deleteHoliday(id);
      addToast({ message: 'Holiday removed', type: 'info' });
      loadHolidays();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Public Holidays ({holidays.length})</h2>
          <p className="text-xs text-mute mt-0.5">
            Declared company and national public holidays integrated with operating calendar policies.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
          Add Holiday
        </Button>
      </div>

      <div className="border border-hairline rounded-md bg-elevated overflow-x-auto shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas border-b border-hairline text-mute uppercase font-mono text-[11px]">
            <tr>
              <th className="p-3">Holiday Name</th>
              <th className="p-3">Date</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-mute">
                  Loading holidays...
                </td>
              </tr>
            ) : holidays.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-mute">
                  No public holidays registered.
                </td>
              </tr>
            ) : (
              holidays.map((h) => (
                <tr key={h._id} className="hover:bg-hairline-soft/30 transition-colors">
                  <td className="p-3 font-semibold text-ink flex items-center gap-2">
                    <Award className="w-4 h-4 text-violet" />
                    <span>{h.name}</span>
                  </td>
                  <td className="p-3 font-mono font-medium text-ink">
                    {(h.date || '').slice(0, 10)}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(h._id)}
                      className="touch-target p-1.5 text-error/70 hover:text-error rounded-sm focus-ring"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Register Public Holiday"
        description="Declared non-working days for standard calendar rules"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Holiday Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Christmas Day"
          />
          <Input
            label="Holiday Date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <div className="pt-2 flex justify-end gap-2 border-t border-hairline">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Register Holiday
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

