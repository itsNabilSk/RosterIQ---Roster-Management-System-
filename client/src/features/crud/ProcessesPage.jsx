import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Plus, Trash2, Edit2, Layers } from 'lucide-react';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function ProcessesPage() {
  const { addToast } = useToast();
  const [processes, setProcesses] = useState([]);
  const [brands, setBrands] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProc, setEditingProc] = useState(null);

  const [formData, setFormData] = useState({
    brandId: '',
    type: 'CS',
    calendarType: 'ALL_EXCEPT_HOLIDAYS',
    customWeekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    holidayPolicy: 'SKIP',
    minStaffDefault: 1,
    minStaffByWeekday: {},
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [procData, brandData] = await Promise.all([
        api.getProcesses(),
        api.getBrands(),
      ]);
      setProcesses(procData || []);
      setBrands(brandData || []);
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
    setEditingProc(null);
    setFormData({
      brandId: brands[0]?._id || '',
      type: 'CS',
      calendarType: 'ALL_EXCEPT_HOLIDAYS',
      customWeekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      holidayPolicy: 'SKIP',
      minStaffDefault: 1,
      minStaffByWeekday: {},
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (proc) => {
    setEditingProc(proc);
    setFormData({
      brandId: proc.brandId?._id || proc.brandId || '',
      type: proc.type,
      calendarType: proc.calendarRule?.type || 'ALL_EXCEPT_HOLIDAYS',
      customWeekdays: proc.calendarRule?.weekdays || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      holidayPolicy: proc.calendarRule?.holidayPolicy || 'SKIP',
      minStaffDefault: proc.minStaffDefault !== undefined ? proc.minStaffDefault : 1,
      minStaffByWeekday: proc.minStaffByWeekday || {},
    });
    setIsModalOpen(true);
  };

  const toggleCustomDay = (day) => {
    setFormData((prev) => {
      const exists = prev.customWeekdays.includes(day);
      const next = exists
        ? prev.customWeekdays.filter((d) => d !== day)
        : [...prev.customWeekdays, day];
      return { ...prev, customWeekdays: next };
    });
  };

  const handleWeekdayStaffChange = (day, val) => {
    setFormData((prev) => {
      const updated = { ...prev.minStaffByWeekday };
      if (val === '' || val === null) {
        delete updated[day];
      } else {
        updated[day] = Number(val);
      }
      return { ...prev, minStaffByWeekday: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const calendarRule =
        formData.calendarType === 'CUSTOM'
          ? {
              type: 'CUSTOM',
              weekdays: formData.customWeekdays,
              holidayPolicy: formData.holidayPolicy,
            }
          : { type: formData.calendarType };

      const payload = {
        brandId: formData.brandId,
        type: formData.type,
        calendarRule,
        minStaffDefault: Number(formData.minStaffDefault),
        minStaffByWeekday: formData.minStaffByWeekday,
      };

      if (editingProc) {
        await api.updateProcess(editingProc._id, payload);
        addToast({ message: 'Process updated', type: 'success' });
      } else {
        await api.createProcess(payload);
        addToast({ message: 'Process created', type: 'success' });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this process? Associated assignments will be removed.')) return;
    try {
      await api.deleteProcess(id);
      addToast({ message: 'Process deleted', type: 'info' });
      loadData();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Processes ({processes.length})</h2>
          <p className="text-xs text-mute mt-0.5">
            Operational workflows per brand, staffing requirements, and calendar policies.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
          Add Process
        </Button>
      </div>

      <div className="border border-hairline rounded-md bg-elevated overflow-x-auto shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas border-b border-hairline text-mute uppercase font-mono text-[11px]">
            <tr>
              <th className="p-3">Brand</th>
              <th className="p-3">Process Type</th>
              <th className="p-3">Calendar Policy</th>
              <th className="p-3">Min Staff</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-mute">
                  Loading processes...
                </td>
              </tr>
            ) : processes.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-mute">
                  No processes configured.
                </td>
              </tr>
            ) : (
              processes.map((p) => (
                <tr key={p._id} className="hover:bg-hairline-soft/30 transition-colors">
                  <td className="p-3 font-semibold text-ink">
                    {p.brandId?.name || 'Unknown Brand'}
                  </td>
                  <td className="p-3 font-mono font-medium text-ink">
                    <Badge variant="neutral" size="sm">
                      {p.type}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <span className="font-mono text-[11px] text-body">
                      {p.calendarRule?.type}
                    </span>
                    {p.calendarRule?.type === 'CUSTOM' && (
                      <div className="text-[10px] text-mute mt-0.5">
                        {(p.calendarRule.weekdays || []).map((d) => d.slice(0, 3)).join(', ')} · Holidays: {p.calendarRule.holidayPolicy || 'SKIP'}
                      </div>
                    )}
                  </td>
                  <td className="p-3 font-mono font-semibold text-ink">
                    <div>{p.minStaffDefault} staff</div>
                    {p.minStaffByWeekday && Object.keys(p.minStaffByWeekday).length > 0 && (
                      <div className="text-[10px] text-link font-normal mt-0.5">
                        Overrides:{' '}
                        {Object.entries(p.minStaffByWeekday)
                          .map(([d, count]) => `${d.slice(0, 3)}:${count}`)
                          .join(', ')}
                      </div>
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
                        onClick={() => handleDelete(p._id)}
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
        title={editingProc ? 'Edit Process' : 'Configure New Process'}
        description="Set minimum coverage and schedule type"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-body">Target Brand</label>
            <select
              value={formData.brandId}
              onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
              className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring cursor-pointer"
            >
              {brands.map((b) => (
                <option key={b._id} value={b._id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-body">Process Type</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring cursor-pointer"
            >
              <option value="CS">CS (Customer Support)</option>
              <option value="ACC">ACC (Abandoned Cart Conversions)</option>
              <option value="RETENTION">RETENTION</option>
              <option value="NDR">NDR (Non-Delivery Reports)</option>
              <option value="CUSTOM">CUSTOM</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-body">Calendar Operating Rule</label>
            <select
              value={formData.calendarType}
              onChange={(e) => setFormData({ ...formData, calendarType: e.target.value })}
              className="touch-target px-3 py-2 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring cursor-pointer"
            >
              <option value="ALL_365">ALL_365 (365 days / 24x7)</option>
              <option value="ALL_EXCEPT_HOLIDAYS">ALL_EXCEPT_HOLIDAYS</option>
              <option value="MON_SAT">MON_SAT (Monday through Saturday)</option>
              <option value="MON_FRI">MON_FRI (Monday through Friday)</option>
              <option value="CUSTOM">CUSTOM (Custom Weekdays & Holiday Rule)</option>
            </select>
          </div>

          {formData.calendarType === 'CUSTOM' && (
            <div className="p-3 bg-canvas border border-hairline rounded-sm space-y-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-medium text-ink">Operating Weekdays</label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const checked = formData.customWeekdays.includes(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleCustomDay(day)}
                        className={`px-2 py-1 rounded-sm text-[11px] font-mono border cursor-pointer transition-colors ${
                          checked
                            ? 'bg-ink text-on-primary border-ink'
                            : 'bg-elevated text-mute border-hairline hover:text-ink'
                        }`}
                      >
                        {day.slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-ink">Public Holiday Policy</label>
                <select
                  value={formData.holidayPolicy}
                  onChange={(e) => setFormData({ ...formData, holidayPolicy: e.target.value })}
                  className="px-2.5 py-1.5 bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring cursor-pointer"
                >
                  <option value="SKIP">SKIP (Closed on Public Holidays)</option>
                  <option value="WORK">WORK (Open even on Public Holidays)</option>
                </select>
              </div>
            </div>
          )}

          <Input
            label="Minimum Staff Required Daily (Default)"
            type="number"
            min={0}
            max={20}
            required
            value={formData.minStaffDefault}
            onChange={(e) => setFormData({ ...formData, minStaffDefault: Number(e.target.value) })}
          />

          <div className="p-3 bg-canvas border border-hairline rounded-sm space-y-2">
            <div className="text-[11px] font-medium text-ink">
              Day-Specific Minimum Staff Overrides (Optional)
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
              {WEEKDAYS.map((day) => (
                <div key={day} className="flex flex-col items-center gap-1">
                  <span className="text-[10px] font-mono text-mute">{day.slice(0, 3)}</span>
                  <input
                    type="number"
                    min={0}
                    max={20}
                    placeholder={String(formData.minStaffDefault)}
                    value={formData.minStaffByWeekday?.[day] ?? ''}
                    onChange={(e) => handleWeekdayStaffChange(day, e.target.value)}
                    className="w-full px-1.5 py-1 text-center bg-elevated border border-hairline rounded-sm text-xs text-ink focus-ring"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-hairline">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingProc ? 'Save Changes' : 'Create Process'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

