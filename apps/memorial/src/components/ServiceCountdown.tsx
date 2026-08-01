import { useEffect, useState } from 'react';
import { Clock, MapPin, Radio, AlertCircle, CheckCircle } from 'lucide-react';

interface ServiceCountdownProps {
  serviceDate: string;
  serviceEndTime?: string | null;
  serviceVenue?: string | null;
  timezone?: string | null;
  livestreamUrl?: string | null;
}

type ServiceStatus = 'upcoming' | 'starting-soon' | 'in-progress' | 'completed';

function formatTime(date: Date, timezone?: string | null): string {
  try {
    return date.toLocaleTimeString('en-ZA', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone || undefined,
    });
  } catch {
    return date.toLocaleTimeString('en-ZA', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
}

function formatDate(date: Date, timezone?: string | null): string {
  try {
    return date.toLocaleDateString('en-ZA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone || undefined,
    });
  } catch {
    return date.toLocaleDateString('en-ZA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export default function ServiceCountdown({
  serviceDate,
  serviceEndTime,
  serviceVenue,
  timezone,
  livestreamUrl,
}: ServiceCountdownProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startDate = new Date(serviceDate);
  const startMs = startDate.getTime();
  const diff = startMs - now;

  let endMs: number;
  if (serviceEndTime) {
    const [h, m] = serviceEndTime.split(':').map(Number);
    const endDate = new Date(startDate);
    endDate.setHours(h, m, 0, 0);
    endMs = endDate.getTime();
  } else {
    endMs = startMs + 3 * 60 * 60 * 1000;
  }

  let status: ServiceStatus;
  if (now < startMs) {
    status = diff <= 60 * 60 * 1000 ? 'starting-soon' : 'upcoming';
  } else if (now < endMs) {
    status = 'in-progress';
  } else {
    status = 'completed';
  }

  return (
    <div className="mx-4 mb-6 animate-fade-up animate-fade-up-delay-1">
      <div className={`rounded-xl border p-5 ${
        status === 'starting-soon'
          ? 'border-green-500/40 bg-green-500/10'
          : status === 'in-progress'
          ? 'border-red-500/40 bg-red-500/10'
          : status === 'completed'
          ? 'border-white/10 bg-white/5'
          : 'border-white/10 bg-white/5'
      }`}>
        {status === 'starting-soon' && (
          <div className="mb-3 flex items-center gap-2 text-green-400">
            <AlertCircle size={16} className="animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-wider">Starting Soon</span>
          </div>
        )}

        <div className="flex items-start gap-3">
          <Clock size={20} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-[var(--brand-accent)] mb-1">Funeral Service</p>
            <p className="font-display text-xl text-[var(--brand-text)]">
              {formatDate(startDate, timezone)}
            </p>
            <p className="text-sm text-[var(--brand-text)]/80 mt-0.5">
              {formatTime(startDate, timezone)}
            </p>
          </div>
        </div>

        {serviceVenue && (
          <div className="mt-3 flex items-start gap-3">
            <MapPin size={16} className="mt-0.5 shrink-0 text-[var(--brand-accent)]/70" />
            <p className="text-sm text-[var(--brand-text)]/75">{serviceVenue}</p>
          </div>
        )}

        {status === 'upcoming' && diff > 0 && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="text-xs uppercase tracking-widest text-[var(--brand-text)]/50 mb-2">Service starts in</p>
            <div className="flex gap-3">
              <DurationBlock value={Math.floor(diff / 86400000)} label="Days" />
              <DurationBlock value={Math.floor((diff % 86400000) / 3600000)} label="Hours" />
              <DurationBlock value={Math.floor((diff % 3600000) / 60000)} label="Minutes" />
              <DurationBlock value={Math.floor((diff % 60000) / 1000)} label="Seconds" />
            </div>
          </div>
        )}

        {status === 'starting-soon' && (
          <div className="mt-4 border-t border-green-500/20 pt-4">
            <p className="text-sm text-green-400 font-medium">
              This service begins in {Math.ceil(diff / 60000)} minutes.
            </p>
            {livestreamUrl && (
              <a
                href={livestreamUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
              >
                <Radio size={16} />
                Watch Live
              </a>
            )}
          </div>
        )}

        {status === 'in-progress' && (
          <div className="mt-4 border-t border-red-500/20 pt-4">
            <div className="flex items-center gap-2 text-red-400">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm font-semibold">Service Currently In Progress</span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-red-500 transition-all duration-1000"
                style={{ width: `${Math.min(100, ((now - startMs) / (endMs - startMs)) * 100)}%` }}
              />
            </div>
            {livestreamUrl && (
              <a
                href={livestreamUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
              >
                <Radio size={16} />
                Watch Live
              </a>
            )}
          </div>
        )}

        {status === 'completed' && (
          <div className="mt-4 border-t border-white/10 pt-4">
            <div className="flex items-center gap-2 text-[var(--brand-text)]/60">
              <CheckCircle size={16} />
              <span className="text-sm">Funeral Service Completed</span>
            </div>
            <p className="mt-1 text-xs text-[var(--brand-text)]/45">
              Thank you for joining us in celebrating the life of our loved one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function DurationBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg bg-white/5 px-3 py-2 min-w-[4rem]">
      <span className="font-display text-2xl text-[var(--brand-text)] tabular-nums">{pad(value)}</span>
      <span className="text-[10px] uppercase tracking-wider text-[var(--brand-text)]/45">{label}</span>
    </div>
  );
}
