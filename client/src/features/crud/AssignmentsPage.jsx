import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Button } from '../../components/ui/Button.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Plus, Trash2, ArrowRightLeft } from 'lucide-react';

export function AssignmentsPage() {
  const { addToast } = useToast();
  const [assignments, setAssignments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [processes, setProcesses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: '',
    processId: '',
    role: 'primary',
    allocationPercent: 100,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [assignData, empData, procData] = await Promise.all([
        api.getAssignments(),
        api.getEmployees(),
        api.getProcesses(),
      ]);
      setAssignments(assignData || []);
      setEmployees(empData || []);
      setProcesses(procData || []);
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
      processId: processes[0]?._id || '',
      role: 'primary',
      allocationPercent: 100,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createAssignment(formData);
      addToast({ message: 'Assignment saved successfully', type: 'success' });
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this assignment?')) return;
    try {
      await api.deleteAssignment(id);
      addToast({ message: 'Assignment removed', type: 'info' });
      loadData();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Assignments ({assignments.length})</h2>
          <p className="text-xs text-mute mt-0.5">
            Many-to-many staffing assignments: link employees to brand processes with primary or backup roles.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
          New Assignment
        </Button>
      </div>

      <div className="border border-hairline rounded-md bg-elevated overflow-x-auto shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas border-b border-hairline text-mute uppercase font-mono text-[11px]">
            <tr>
              <th className="p-3">Employee</th>
              <th className="p-3">Brand & Process</th>
              <th className="p-3">Role</th>
              <th className="p-3">Allocation</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-mute">
                  Loading assignments...
                </td>
              </tr>
            ) : assignments.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-mute">
                  No assignments created.
                </td>
              </tr>
            ) : (
              assignments.map((a) => (
                <tr key={a._id} className="hover:bg-hairline-soft/30 transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-ink">{a.employeeId?.name || 'Staff Member'}</div>
                    <div className="text-[11px] text-mute">{a.employeeId?.email}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-ink">
                      {a.processId?.brandId?.name || 'Brand'}
                    </div>
                    <div className="text-[11px] font-mono text-mute">
                      {a.processId?.type} ({a.processId?.calendarRule?.type})
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant={a.role === 'primary' ? 'neutral' : 'info'} size="sm">
                      {a.role === 'primary' ? 'Primary' : 'Backup'}
                    </Badge>
                  </td>
                  <td className="p-3 font-mono font-semibold">
                    {a.allocationPercent || 100}%
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(a._id)}
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
        title="Assign Employee to Process"
        description="Connect specialist to brand operational duty"
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

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-body">Brand & Process</label>
            <select
              value={formData.processId}
              onChange={(e) => setFormData({ ...formData, processId: e.target.value })}
              className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring cursor-pointer"
            >
              {processes.map((proc) => (
                <option key={proc._id} value={proc._id}>
                  {proc.brandId?.name || 'Brand'} — {proc.type} ({proc.calendarRule?.type})
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-body">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring cursor-pointer"
            >
              <option value="primary">Primary Responsible</option>
              <option value="backup">Designated Backup</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-hairline">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Assignment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

