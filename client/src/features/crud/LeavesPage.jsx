import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Plus, Check, X, CalendarX, Clock, Trash2 } from 'lucide-react';

export function LeavesPage() {
  const { addToast } = useToast();
  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: '',
    date: '2025-12-01',
    type: 'PLANNED',
    status: 'APPROVED',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [leaveData, empData] = await Promise.all([
        api.getLeaves(),
        api.getEmployees(),
      ]);
      setLeaves(leaveData || []);
      setEmployees(empData || []);
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setFormData({
      employeeId: employees[0]?._id || '',
      date: '2025-12-01',
      type: 'PLANNED',
      status: 'APPROVED',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createLeave(formData);
      addToast({ message: 'Leave record recorded', type: 'success' });
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  const handleToggleStatus = async (leave, newStatus) => {
    try {
      await api.updateLeave(leave._id, { status: newStatus });
      addToast({ message: `Leave status updated to ${newStatus}`, type: 'success' });
      loadData();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this leave record?')) return;
    try {
      await api.deleteLeave(id);
      addToast({ message: 'Leave deleted', type: 'info' });
      loadData();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Planned Leaves & Comp-Offs ({leaves.length})</h2>
          <p className="text-xs text-mute mt-0.5">
            Pre-approved absences and comp-offs integrated into constraint checking.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
          Record Leave
        </Button>
      </div>

      <div className="border border-hairline rounded-md bg-elevated overflow-x-auto shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas border-b border-hairline text-mute uppercase font-mono text-[11px]">
            <tr>
              <th className="p-3">Employee</th>
              <th className="p-3">Date</th>
              <th className="p-3">Absence Type</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-mute">
                  Loading leaves...
                </td>
              </tr>
            ) : leaves.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-mute">
                  No leaves or comp-offs recorded.
                </td>
              </tr>
            ) : (
              leaves.map((l) => (
                <tr key={l._id} className="hover:bg-hairline-soft/30 transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-ink">{l.employeeId?.name || 'Staff Member'}</div>
                    <div className="text-[11px] text-mute">{l.employeeId?.email}</div>
                  </td>
                  <td className="p-3 font-mono font-medium text-ink">
                    {(l.date || '').slice(0, 10)}
                  </td>
                  <td className="p-3">
                    <Badge variant={l.type === 'COMP_OFF' ? 'success' : 'warning'} size="sm">
                      {l.type === 'COMP_OFF' ? 'Comp-Off' : 'Planned Leave'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge variant={l.status === 'APPROVED' ? 'neutral' : 'warning'} size="sm">
                      {l.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {l.status === 'PENDING' ? (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(l, 'APPROVED')}
                          title="Approve Leave"
                          className="touch-target p-1.5 text-success hover:bg-success-soft rounded-sm focus-ring"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(l, 'PENDING')}
                          title="Mark Pending"
                          className="touch-target p-1.5 text-mute hover:bg-hairline-soft rounded-sm focus-ring"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(l._id)}
                        className="touch-target p-1.5 text-error/70 hover:text-error rounded-sm focus-ring"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
        title="Record Leave / Comp-Off"
        description="Add employee absence for monthly scheduling"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-body">Employee</label>
            <select
              value={formData.employeeId}
              onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
              className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring cursor-pointer"
            >
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <Input
            label="Absence Date"
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-body">Absence Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring cursor-pointer"
            >
              <option value="PLANNED">PLANNED (Annual/Vacation Leave)</option>
              <option value="COMP_OFF">COMP_OFF (Compensatory Off)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-body">Approval Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring cursor-pointer"
            >
              <option value="APPROVED">APPROVED (Locks into engine)</option>
              <option value="PENDING">PENDING</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-hairline">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Absence
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

