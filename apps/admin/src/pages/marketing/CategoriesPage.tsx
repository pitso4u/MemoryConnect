import { FormEvent, useEffect, useState } from 'react';
import { Check, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { api, BrochureCategory } from '../../lib/api';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<BrochureCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      setCategories(await api.getBrochureCategories());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setName('');
    setShowForm(true);
    setError('');
  };

  const openEdit = (cat: BrochureCategory) => {
    setEditingId(cat.id);
    setName(cat.name);
    setShowForm(true);
    setError('');
  };

  const cancel = () => {
    setShowForm(false);
    setEditingId(null);
    setName('');
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const updated = await api.updateBrochureCategory(editingId, { name: name.trim() });
        setCategories((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        setMessage('Category updated');
      } else {
        const created = await api.createBrochureCategory({ name: name.trim() });
        setCategories((prev) => [...prev, created]);
        setMessage('Category created');
      }
      cancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: BrochureCategory) => {
    if ((cat._count?.brochures ?? 0) > 0) {
      setError(`Cannot delete "${cat.name}" — it has ${cat._count?.brochures ?? 0} brochure(s) assigned`);
      return;
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return;
    try {
      await api.deleteBrochureCategory(cat.id);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setMessage('Category deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (loading) return <div className="p-8 text-muted">Loading categories...</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Marketing Hub</p>
            <h1 className="mt-3 font-display text-4xl text-ink">Brochure Categories</h1>
          </div>
          {!showForm && (
            <button onClick={openNew} className="brand-button flex items-center gap-2 px-5 py-3 text-sm font-semibold">
              <Plus size={16} /> Add Category
            </button>
          )}
        </div>

        {error && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="mt-6 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><Check size={15} />{message}</div>}

        {showForm && (
          <form onSubmit={handleSave} className="mt-6 rounded-lg border border-parchment-dark bg-white p-6">
            <div className="flex items-end gap-4">
              <label className="block flex-1">
                <span className="mb-1.5 block text-xs font-semibold text-muted">Category Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Funeral Packages" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" autoFocus />
              </label>
              <button type="submit" disabled={saving} className="brand-button px-4 py-2.5 text-sm font-semibold" style={saving ? { opacity: 0.6 } : {}}>
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={cancel} className="rounded-lg border border-parchment-dark px-4 py-2.5 text-sm text-muted transition hover:text-ink">
                Cancel
              </button>
            </div>
          </form>
        )}

        {categories.length === 0 ? (
          <div className="mt-12 text-center">
            <Tags size={48} className="mx-auto text-parchment-dark/40" />
            <p className="mt-4 text-lg font-semibold text-ink">No categories yet</p>
            <p className="mt-1 text-sm text-muted">Create your first category to organise brochures.</p>
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-lg border border-parchment-dark bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-parchment-dark bg-parchment/50 text-left text-xs font-semibold uppercase text-muted">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Brochures</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className="border-b border-parchment-dark/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{cat.name}</td>
                    <td className="px-4 py-3 text-muted">{cat.slug}</td>
                    <td className="px-4 py-3 text-muted">{cat._count?.brochures ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(cat)} className="rounded-lg p-1.5 text-muted transition hover:bg-parchment hover:text-ink" title="Edit">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => handleDelete(cat)} className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
