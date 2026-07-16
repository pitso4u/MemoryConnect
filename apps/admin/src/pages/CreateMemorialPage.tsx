import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { X, Image as ImageIcon } from 'lucide-react';

export default function CreateMemorialPage() {
  const [form, setForm] = useState({
    deceasedName: '',
    serviceDate: '',
    serviceVenue: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Logo must be less than 5MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const memorial = await api.createMemorial(form);
      if (logoFile) {
        await api.uploadLogo(memorial.id, logoFile);
      }
      navigate(`/memorial/${memorial.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create memorial');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl p-4 sm:p-6 lg:p-8">
      <h1 className="font-display text-3xl text-ink mb-1">Create Memorial</h1>
      <p className="text-muted mb-8">Step 1 — Basic information about the deceased</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="brand-card space-y-5 p-4 sm:p-6">
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
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Funeral Home Logo (Optional)</label>
          <div className="space-y-3">
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="logo-upload"
              />
              <label
                htmlFor="logo-upload"
                className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg transition-colors ${
                  logoPreview
                    ? 'border-gold bg-gold/5'
                    : 'border-parchment-dark hover:border-gold/50 hover:bg-gold/5'
                }`}
              >
                {logoPreview ? (
                  <div className="relative w-full max-w-xs">
                    <img
                      src={logoPreview}
                      alt="Logo preview"
                      className="w-full h-auto max-h-32 object-contain rounded"
                    />
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition"
                      aria-label="Remove logo"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <ImageIcon size={32} className="mx-auto mb-2 text-parchment-dark/50" />
                    <p className="text-sm text-ink">Click or drag to upload a logo</p>
                    <p className="text-xs text-muted mt-1">PNG, JPG up to 5MB. Recommended: 400x200px</p>
                  </div>
                )}
              </label>
            </div>
            {logoPreview && (
              <p className="text-xs text-green-600 text-center">Logo will be displayed at the bottom of the memorial page</p>
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="brand-button px-6 py-2.5 font-medium transition disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create & Continue'}
        </button>
      </form>
    </div>
  );
}
