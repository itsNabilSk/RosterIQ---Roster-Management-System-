import React, { useState, useEffect } from 'react';
import { api } from '../../api/client.js';
import { Button } from '../../components/ui/Button.jsx';
import { Input } from '../../components/ui/Input.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { useToast } from '../../components/ui/Toast.jsx';
import { Plus, Building2, Trash2, Edit2 } from 'lucide-react';

export function BrandsPage() {
  const { addToast } = useToast();
  const [brands, setBrands] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [name, setName] = useState('');

  const loadBrands = async () => {
    setIsLoading(true);
    try {
      const data = await api.getBrands();
      setBrands(data || []);
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBrands();
  }, []);

  const handleOpenCreate = () => {
    setEditingBrand(null);
    setName('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (brand) => {
    setEditingBrand(brand);
    setName(brand.name);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBrand) {
        await api.updateBrand(editingBrand._id, { name });
        addToast({ message: 'Brand updated', type: 'success' });
      } else {
        await api.createBrand({ name });
        addToast({ message: 'Brand created', type: 'success' });
      }
      setIsModalOpen(false);
      loadBrands();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  const handleDelete = async (id, brandName) => {
    if (!window.confirm(`Delete ${brandName}? All associated processes and assignments will be removed.`)) return;
    try {
      await api.deleteBrand(id);
      addToast({ message: 'Brand deleted', type: 'info' });
      loadBrands();
    } catch (err) {
      addToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Brands ({brands.length})</h2>
          <p className="text-xs text-mute mt-0.5">
            Operational client accounts and business units requiring roster coverage.
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleOpenCreate}>
          Add Brand
        </Button>
      </div>

      <div className="border border-hairline rounded-md bg-elevated overflow-x-auto shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-canvas border-b border-hairline text-mute uppercase font-mono text-[11px]">
            <tr>
              <th className="p-3">Brand Name</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {isLoading ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-mute">
                  Loading brands...
                </td>
              </tr>
            ) : brands.length === 0 ? (
              <tr>
                <td colSpan={3} className="p-8 text-center text-mute">
                  No brands configured.
                </td>
              </tr>
            ) : (
              brands.map((b) => (
                <tr key={b._id} className="hover:bg-hairline-soft/30 transition-colors">
                  <td className="p-3 font-semibold text-ink flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-mute" />
                    <span>{b.name}</span>
                  </td>
                  <td className="p-3">
                    <Badge variant={b.active ? 'success' : 'neutral'} size="sm">
                      {b.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(b)}
                        className="touch-target p-1.5 text-mute hover:text-ink rounded-sm focus-ring"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(b._id, b.name)}
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
        title={editingBrand ? 'Edit Brand' : 'Add New Brand'}
        description="Configure client operational account"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Brand Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Global"
          />
          <div className="pt-2 flex justify-end gap-2 border-t border-hairline">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {editingBrand ? 'Save Changes' : 'Create Brand'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

