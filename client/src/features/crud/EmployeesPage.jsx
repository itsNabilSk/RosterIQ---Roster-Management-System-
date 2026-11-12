import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Select } from '../../components/ui/Select.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Plus, Search, Trash2, Edit2, Users } from 'lucide-react';

export function EmployeesPage() {
  const { addToast } = useToast();
  const [employees, setEmployees] = useState([]);
  const [pods, setPods] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedPod, setSelectedPod] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    podId: '',
    isPodLead: false,
    weeklyOffPreference: ['Sunday'],
    maxConsecutiveWorkDays: 6,
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [empData, podData] = await Promise.all([
        api.getEmployees(`?search=${search}${selectedPod ? `&podId=${selectedPod}` : ''}`),
        api.getPods(),
      ]);
      setEmployees(empData || []);
      setPods(podData || []);
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, selectedPod]);

  const handleOpenCreate = () => {
    setEditingEmp(null);
    setFormData({
      name: '',
      email: '',
      podId: pods[0]?._id || '',
      isPodLead: false,
      weeklyOffPreference: ['Sunday'],
      maxConsecutiveWorkDays: 6,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp) => {
    setEditingEmp(emp);
    setFormData({
      name: emp.name,
      email: emp.email,
      podId: emp.podId?._id || emp.podId || '',
      isPodLead: emp.isPodLead || false,
      weeklyOffPreference: emp.weeklyOffPreference || ['Sunday'],
      maxConsecutiveWorkDays: emp.maxConsecutiveWorkDays || 6,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmp) {
        await api.updateEmployee(editingEmp._id, formData);
        addToast({ message: 'Employee updated successfully', type: 'success' });
      } else {
        await api.createEmployee(formData);
        addToast({ message: 'Employee created successfully', type: 'success' });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete ${name}? Their assignments will also be removed.`)) return;
    try {
      await api.deleteEmployee(id);
      addToast({ message: 'Employee deleted', type: 'info' });
      loadData();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Employees ({employees.length})</h2>
          <p className="text-xs text-mute mt-0.5">
            Manage workforce roster preferences, pod assignments, and lead roles.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
          Add Employee
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-elevated p-3 border border-hairline rounded-md">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-mute absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee name or email..."
            className="w-full pl-9 pr-3 py-2 bg-canvas border border-hairline rounded-sm text-xs text-ink focus-ring"
          />
        </div>

        <select
          value={selectedPod}
          onChange={(e) => setSelectedPod(e.target.value)}
          aria-label="Filter by Pod"
          className="bg-canvas border border-hairline rounded-sm px-3 py-2 text-xs text-ink focus-ring cursor-pointer"
        >
          <option value="">All Pods</option>
          {pods.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Employee List Table */}
      <div className="border border-hairline rounded-md bg-elevated overflow-x-auto shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas border-b border-hairline text-mute uppercase font-mono text-[11px]">
            <tr>
              <th className="p-3">Name & Email</th>
              <th className="p-3">Pod</th>
              <th className="p-3">Role</th>
              <th className="p-3">Weekly Off Pref</th>
              <th className="p-3">Max Work Days</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-mute">
                  Loading employees...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-mute">
                  No employees found matching criteria.
                </td>
              </tr>
            ) : (
              employees.map((emp) => (
                <tr key={emp._id} className="hover:bg-hairline-soft/30 transition-colors">
                  <td className="p-3">
                    <div className="font-semibold text-ink">{emp.name}</div>
                    <div className="text-[11px] text-mute">{emp.email}</div>
                  </td>
                  <td className="p-3">
                    {emp.podId ? (
                      <Badge variant="neutral" size="sm">
                        {emp.podId.name || 'Pod Member'}
                      </Badge>
                    ) : (
                      <span className="text-mute text-[11px]">Unassigned</span>
                    )}
                  </td>
                  <td className="p-3">
                    {emp.isPodLead ? (
                      <Badge variant="info" size="sm">
                        Pod Lead
                      </Badge>
                    ) : (
                      <span className="text-mute">Specialist</span>
                    )}
                  </td>
                  <td className="p-3 font-mono text-[11px]">
                    {(emp.weeklyOffPreference || []).join(', ')}
                  </td>
                  <td className="p-3 font-mono">{emp.maxConsecutiveWorkDays || 6} days</td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(emp)}
                        aria-label={`Edit ${emp.name}`}
                        className="touch-target p-1.5 text-mute hover:text-ink rounded-sm focus-ring transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(emp._id, emp.name)}
                        aria-label={`Delete ${emp.name}`}
                        className="touch-target p-1.5 text-error/70 hover:text-error rounded-sm focus-ring transition-colors"
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

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmp ? 'Edit Employee' : 'Add New Employee'}
        description="Configure preferences and pod affiliation"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Rahul Sharma"
          />

          <Input
            label="Corporate Email"
            type="email"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="e.g. rahul.sharma@rosteriq.io"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-body">Assigned Pod</label>
            <select
              value={formData.podId}
              onChange={(e) => setFormData({ ...formData, podId: e.target.value })}
              className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring"
            >
              <option value="">Unassigned</option>
              {pods.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="is-pod-lead"
              checked={formData.isPodLead}
              onChange={(e) => setFormData({ ...formData, isPodLead: e.target.checked })}
              className="w-4 h-4 rounded-xs border-hairline accent-ink cursor-pointer"
            />
            <label htmlFor="is-pod-lead" className="text-xs text-ink font-medium cursor-pointer">
              Designate as Pod Lead
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-body">
              Weekly Off Preference (comma-separated days)
            </label>
            <input
              type="text"
              value={formData.weeklyOffPreference.join(', ')}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  weeklyOffPreference: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="e.g. Sunday, Monday"
              className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring"
            />
          </div>

          <Input
            label="Max Consecutive Work Days"
            type="number"
            min={1}
            max={14}
            value={formData.maxConsecutiveWorkDays}
            onChange={(e) => setFormData({ ...formData, maxConsecutiveWorkDays: Number(e.target.value) })}
          />

          <div className="pt-2 flex justify-end gap-2 border-t border-hairline">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingEmp ? 'Save Changes' : 'Create Employee'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

