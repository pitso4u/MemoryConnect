import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ProjectorData } from '../lib/api';

export default function ProjectorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<ProjectorData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    const fetch = () =>
      api.getProjector(slug)
        .then(setData)
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projector data'));
    fetch();
    const interval = setInterval(fetch, 3000);
    return () => clearInterval(interval);
  }, [slug]);

  if (!data && !error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/40 text-2xl font-display">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-400 text-2xl font-display mb-4">Connection Error</p>
          <p className="text-white/40 text-lg">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-white/40 text-2xl font-display">Loading...</p>
      </div>
    );
  }

  const progress = data!.totalItems > 0
    ? ((data!.currentIndex + 1) / data!.totalItems) * 100
    : 0;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col p-12 select-none">
      {/* Announcements ticker */}
      {data!.announcements.length > 0 && (
        <div className="bg-amber-900/40 border border-amber-600/30 rounded-lg px-6 py-3 mb-8 text-center">
          <p className="text-amber-200 text-xl">{data!.announcements[0].message}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className="text-amber-400 text-lg uppercase tracking-[0.4em] mb-6">Now Speaking</p>

        <h1 className="font-display text-7xl md:text-8xl lg:text-9xl mb-4 leading-none">
          {data!.currentItem?.speaker || data!.currentItem?.title || '—'}
        </h1>

        {data!.currentItem?.title && data!.currentItem?.speaker && (
          <p className="text-white/40 text-3xl mt-2">{data!.currentItem.title}</p>
        )}

        {data!.nextItem && (
          <div className="mt-16">
            <p className="text-white/30 text-sm uppercase tracking-widest mb-2">Up Next</p>
            <p className="text-white/60 text-4xl font-display">
              {data!.nextItem.speaker || data!.nextItem.title}
            </p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="mt-auto">
        <div className="flex items-center justify-between text-white/30 text-sm mb-2">
          <span>{data!.deceasedName}</span>
          <span>{data!.currentIndex + 1} / {data!.totalItems}</span>
        </div>
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
