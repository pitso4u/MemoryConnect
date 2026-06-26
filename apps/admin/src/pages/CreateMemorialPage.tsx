import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function CreateMemorialPage() {
  const [form, setForm] = useState({
    deceasedName: '',
    serviceDate: '',
    serviceVenue: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const memorial = await api.createMemorial(form);
      navigate(`/memorial/${memorial.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create memorial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="font-display text-3xl text-ink mb-1">Create Memorial</h1>
      <p className="text-muted mb-8">Step 1 — Basic information about the deceased</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-xl border border-parchment-dark p-6">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">
            Full Name of Deceased *
          </label>
          <input
            type="text"
            value={form.deceasedName}
            onChange={(e) => setForm({ ...form, deceasedName: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-parchment-dark focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
            placeholder="e.g. Mr. David Mokoena"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Service Date</label>
          <input
            type="datetime-local"
            value={form.serviceDate}
            onChange={(e) => setForm({ ...form, serviceDate: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-parchment-dark focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Service Venue</label>
          <input
            type="text"
            value={form.serviceVenue}
            onChange={(e) => setForm({ ...form, serviceVenue: e.target.value })}
            className="w-full px-4 py-2.5 rounded-lg border border-parchment-dark focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold transition"
            placeholder="e.g. St. Mary's Church, Soweto"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-ink text-parchment rounded-lg font-medium hover:bg-ink-light transition disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create & Continue'}
        </button>
      </form>
    </div>
  );
}
