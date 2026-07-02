import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, photoUrl, ProjectorData } from '../lib/api';

export const SLIDESHOW_INTERVAL_MS = 8000;

export default function ProjectorPage() {
  const { slug } = useParams<{ slug: string }>();
  const [data, setData] = useState<ProjectorData | null>(null);
  const [error, setError] = useState('');
  const [photoIndex, setPhotoIndex] = useState(0);
  const previewToken = new URLSearchParams(window.location.search).get('preview') || undefined;

  useEffect(() => {
    if (!slug) return;
    const fetchProjector = () =>
      api.getProjector(slug, previewToken)
        .then((projector) => {
          setData(projector);
          setError('');
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projector data'));
    fetchProjector();
    const interval = window.setInterval(fetchProjector, 3000);
    return () => window.clearInterval(interval);
  }, [slug, previewToken]);

  const photoCount = data?.photos.length || 0;

  useEffect(() => {
    if (photoCount <= 1) return;
    const interval = window.setInterval(
      () => setPhotoIndex((current) => (current + 1) % photoCount),
      SLIDESHOW_INTERVAL_MS,
    );
    return () => window.clearInterval(interval);
  }, [photoCount]);

  useEffect(() => {
    if (photoIndex >= photoCount) setPhotoIndex(0);
  }, [photoCount, photoIndex]);

  if (!data && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <p className="font-display text-2xl text-white/40">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6">
        <div className="text-center">
          <p className="mb-4 font-display text-2xl text-red-400">Connection Error</p>
          <p className="text-lg text-white/40">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-white/10 px-6 py-3 text-white transition hover:bg-white/20"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const progress = data.totalItems > 0
    ? ((data.currentIndex + 1) / data.totalItems) * 100
    : 0;
  const currentPhoto = data.photos[photoIndex];

  if (photoCount === 0) {
    return (
      <div className="flex min-h-screen select-none flex-col bg-black p-8 text-white sm:p-12">
        <Announcement message={data.announcements[0]?.message} />
        <ProgrammeFocus data={data} />
        <ProgrammeProgress data={data} progress={progress} />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen select-none overflow-hidden bg-[#08080d] text-white">
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-3xl transition-[background-image] duration-1000"
        style={{ backgroundImage: `url(${photoUrl(currentPhoto.url)})` }}
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_42%,transparent_0%,rgba(0,0,0,0.18)_48%,rgba(0,0,0,0.72)_100%)]" />

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[minmax(0,1.6fr)_minmax(22rem,0.72fr)]">
        <section className="relative min-h-[56vh] overflow-hidden lg:min-h-screen" aria-label="Memorial photo slideshow">
          {data.photos.map((photo, index) => (
            <img
              key={photo.id}
              src={photoUrl(photo.url)}
              alt={photo.caption || `Memorial photograph ${index + 1} of ${photoCount}`}
              aria-hidden={index !== photoIndex}
              data-active={index === photoIndex ? 'true' : 'false'}
              className={`absolute inset-0 h-full w-full object-contain p-4 transition-all duration-[1600ms] ease-in-out sm:p-8 ${
                index === photoIndex ? 'scale-100 opacity-100' : 'pointer-events-none scale-[1.015] opacity-0'
              }`}
            />
          ))}

          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent lg:hidden" />
          <div className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/75 backdrop-blur-md sm:left-8 sm:top-8">
            In loving memory
          </div>
          <div className="absolute bottom-5 right-5 rounded-full bg-black/40 px-3 py-1.5 text-xs tabular-nums text-white/70 backdrop-blur-md sm:bottom-8 sm:right-8">
            {photoIndex + 1} / {photoCount}
          </div>
          {currentPhoto.caption && (
            <p className="absolute bottom-5 left-5 max-w-[70%] text-sm text-white/75 drop-shadow-lg sm:bottom-8 sm:left-8 sm:text-base">
              {currentPhoto.caption}
            </p>
          )}
        </section>

        <aside className="flex min-h-[44vh] flex-col border-t border-white/10 bg-black/45 p-6 backdrop-blur-xl sm:p-9 lg:min-h-screen lg:border-l lg:border-t-0 lg:p-10 xl:p-12">
          <Announcement message={data.announcements[0]?.message} />
          <ProgrammeFocus data={data} compact />
          <ProgrammeProgress data={data} progress={progress} />
          <div className="mt-5 flex gap-1.5" aria-label={`Photo ${photoIndex + 1} of ${photoCount}`}>
            {data.photos.map((photo, index) => (
              <span
                key={photo.id}
                className={`h-1 rounded-full transition-all duration-700 ${index === photoIndex ? 'w-8 bg-amber-400' : 'w-3 bg-white/15'}`}
                aria-hidden="true"
              />
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Announcement({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-7 rounded-lg border border-amber-600/30 bg-amber-900/40 px-5 py-3 text-center">
      <p className="text-lg text-amber-200">{message}</p>
    </div>
  );
}

function ProgrammeFocus({ data, compact = false }: { data: ProjectorData; compact?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col justify-center ${compact ? 'text-left' : 'items-center text-center'}`}>
      <p className="mb-5 text-sm font-semibold uppercase tracking-[0.34em] text-amber-400">Now Speaking</p>
      <h1 className={`font-display leading-[0.92] text-white ${compact ? 'text-5xl sm:text-6xl xl:text-7xl' : 'text-7xl md:text-8xl lg:text-9xl'}`}>
        {data.currentItem?.speaker || data.currentItem?.title || '—'}
      </h1>
      {data.currentItem?.title && data.currentItem?.speaker && (
        <p className={`mt-4 text-white/45 ${compact ? 'text-xl xl:text-2xl' : 'text-3xl'}`}>{data.currentItem.title}</p>
      )}
      {data.nextItem && (
        <div className={compact ? 'mt-10 border-l border-amber-400/50 pl-5' : 'mt-16'}>
          <p className="mb-2 text-xs uppercase tracking-[0.22em] text-white/30">Up Next</p>
          <p className={`font-display text-white/65 ${compact ? 'text-3xl xl:text-4xl' : 'text-4xl'}`}>
            {data.nextItem.speaker || data.nextItem.title}
          </p>
        </div>
      )}
    </div>
  );
}

function ProgrammeProgress({ data, progress }: { data: ProjectorData; progress: number }) {
  return (
    <div className="mt-auto pt-8">
      <div className="mb-2 flex items-center justify-between text-sm text-white/35">
        <span className="truncate pr-4">{data.deceasedName}</span>
        <span className="shrink-0 tabular-nums">{data.currentIndex + 1} / {data.totalItems}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full bg-amber-500 transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
