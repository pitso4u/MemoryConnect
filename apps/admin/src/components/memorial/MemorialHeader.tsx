import { Link } from 'react-router-dom';
import { Globe, Monitor, ArrowLeft } from 'lucide-react';
import { MemorialDetail } from '../../lib/api';
import { getMemorialBaseUrl, memorialPageUrl } from '../../lib/config';

interface MemorialHeaderProps {
  memorial: MemorialDetail;
  saving: boolean;
  onPublish: () => void;
}

export function MemorialHeader({ memorial, saving, onPublish }: MemorialHeaderProps) {
  const demoNetworkUrl = memorial.settings?.demoNetworkUrl;
  const guestBaseUrl = getMemorialBaseUrl(demoNetworkUrl);
  const guestMemorialUrl = memorialPageUrl(memorial.slug, demoNetworkUrl);

  return (
    <>
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink mb-6 transition">
        <ArrowLeft size={16} /> Back to memorials
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">{memorial.deceasedName}</h1>
          <p className="text-muted mt-1 text-sm">
            {guestBaseUrl.replace(/^https?:\/\//, '')}/{memorial.slug}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={guestMemorialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-parchment-dark rounded-lg text-sm hover:bg-white transition"
          >
            <Globe size={16} /> Preview
          </a>
          <a
            href={`${guestMemorialUrl}/projector`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-parchment-dark rounded-lg text-sm hover:bg-white transition"
          >
            <Monitor size={16} /> Projector
          </a>
          <button
            onClick={onPublish}
            disabled={saving}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              memorial.status === 'published'
                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                : 'bg-ink text-parchment hover:bg-ink-light'
            }`}
          >
            {memorial.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      </div>
    </>
  );
}
