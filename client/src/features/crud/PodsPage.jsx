import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Plus, Users, Trash2, Edit2 } from 'lucide-react';

export function PodsPage() {
  const { addToast } = useToast();
  const [pods, setPods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPod, setEditingPod] = useState(null);

  const [name, setName] = useState('');
  const [leadId, setLeadId] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [podData, empData] = await Promise.all([api.getPods(), api.getEmployees()]);
      setPods(podData || []);
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
    setEditingPod(null);
    setName('');
    setLeadId('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (pod) => {
    setEditingPod(pod);
    setName(pod.name);
    setLeadId(pod.leadId?._id || pod.leadId || '');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPod) {
        await api.updatePod(editingPod._id, { name, leadId: leadId || null });
        addToast({ message: 'Pod updated', type: 'success' });
      } else {
        await api.createPod({ name, leadId: leadId || null });
        addToast({ message: 'Pod created', type: 'success' });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  const handleDelete = async (id, podName) => {
    if (!window.confirm(`Delete ${podName}?`)) return;
    try {
      await api.deletePod(id);
      addToast({ message: 'Pod deleted', type: 'info' });
      loadData();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Pods ({pods.length})</h2>
          <p className="text-xs text-mute mt-0.5">
            Operational team units with designated leads for backup affinity ranking.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
          Add Pod
        </Button>
      </div>

      <div className="border border-hairline rounded-md bg-elevated overflow-x-auto shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas border-b border-hairline text-mute uppercase font-mono text-[11px]">
            <tr>
              <th className="p-3">Pod Name</th>
              <th className="p-3">Pod Lead</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-mute">
                  Loading pods...
                </td>
              </tr>
            ) : pods.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-mute">
                  No pods configured.
                </td>
              </tr>
            ) : (
              pods.map((p) => (
                <tr key={p._id} className="hover:bg-hairline-soft/30 transition-colors">
                  <td className="p-3 font-semibold text-ink flex items-center gap-2">
                    <Users className="w-4 h-4 text-mute" />
                    <span>{p.name}</span>
                  </td>
                  <td className="p-3 text-body font-medium">
                    {p.leadId?.name ? (
                      <span>{p.leadId.name}</span>
                    ) : (
                      <span className="text-mute italic">No Lead Assigned</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(p)}
                        className="touch-target p-1.5 text-mute hover:text-ink rounded-sm focus-ring"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(p._id, p.name)}
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
        title={editingPod ? 'Edit Pod' : 'Create Pod'}
        description="Configure operational cluster and leadership"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Pod Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pod Titan (Fintech)"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-body">Designated Pod Lead</label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring cursor-pointer"
            >
              <option value="">None (Unassigned)</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-hairline">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingPod ? 'Save Changes' : 'Create Pod'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

