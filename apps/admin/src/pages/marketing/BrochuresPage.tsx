import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Copy, FileText, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, Brochure } from '../../lib/api';

export default function BrochuresPage() {
  const navigate = useNavigate();
  const [brochures, setBrochures] = useState<Brochure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      setBrochures(await api.getBrochures());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brochures');
    } finally {
      setLoading(false);
    }
  };

  const togglePublished = async (brochure: Brochure) => {
    try {
      const updated = await api.updateBrochure(brochure.id, { published: !brochure.published });
      setBrochures((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const toggleFeatured = async (brochure: Brochure) => {
    try {
      const updated = await api.updateBrochure(brochure.id, { featured: !brochure.featured });
      setBrochures((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await api.duplicateBrochure(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Duplicate failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this brochure?')) return;
    try {
      await api.deleteBrochure(id);
      setBrochures((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  if (loading) return <div className="p-8 text-muted">Loading brochures...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Marketing Hub</p>
            <h1 className="mt-3 font-display text-4xl text-ink">Digital Brochures</h1>
          </div>
          <Link to="/marketing/brochures/new" className="brand-button flex items-center gap-2 px-5 py-3 text-sm font-semibold">
            <Plus size={16} /> New Brochure
          </Link>
        </div>

        {brochures.length === 0 ? (
          <div className="mt-12 text-center">
            <FileText size={48} className="mx-auto text-parchment-dark/40" />
            <p className="mt-4 text-lg font-semibold text-ink">No brochures yet</p>
            <p className="mt-1 text-sm text-muted">Create your first digital brochure to get started.</p>
            <Link to="/marketing/brochures/new" className="brand-button mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold">
              <Plus size={16} /> Create Brochure
            </Link>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-lg border border-parchment-dark bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-parchment-dark bg-parchment/50 text-left text-xs font-semibold uppercase text-muted">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Published</th>
                  <th className="px-4 py-3">Featured</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Enquiries</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {brochures.map((brochure) => (
                  <tr key={brochure.id} className="border-b border-parchment-dark/50 last:border-0">
                    <td className="px-4 py-3 font-medium text-ink">{brochure.title}</td>
                    <td className="px-4 py-3 text-muted">{brochure.category?.name || '-'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => togglePublished(brochure)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          brochure.published ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {brochure.published ? 'Published' : 'Draft'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleFeatured(brochure)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          brochure.featured ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {brochure.featured ? 'Featured' : 'Standard'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted">{brochure.viewCount}</td>
                    <td className="px-4 py-3 text-muted">{brochure._count?.enquiries ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => navigate(`/marketing/brochures/${brochure.id}`)}
                          className="rounded-lg p-1.5 text-muted transition hover:bg-parchment hover:text-ink"
                          title="Edit"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDuplicate(brochure.id)}
                          className="rounded-lg p-1.5 text-muted transition hover:bg-parchment hover:text-ink"
                          title="Duplicate"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(brochure.id)}
                          className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50"
                          title="Delete"
                        >
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
