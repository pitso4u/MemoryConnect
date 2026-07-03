import { Pause, Play, SkipForward, SkipBack } from 'lucide-react';
import { ProgrammeItem } from '@memorialconnect/shared';

interface ProjectorControlsProps {
  programme: ProgrammeItem[];
  currentIndex: number;
  onNext: () => void;
  onPrevious: () => void;
  autoAdvance: boolean;
  onAutoAdvanceChange: (enabled: boolean) => void;
  busy?: boolean;
}

export function ProjectorControls({
  programme,
  currentIndex,
  onNext,
  onPrevious,
  autoAdvance,
  onAutoAdvanceChange,
  busy = false,
}: ProjectorControlsProps) {
  const currentItem = programme[currentIndex];
  const nextItem = programme[currentIndex + 1];

  return (
    <div className="bg-ink text-parchment rounded-xl p-6 mb-8">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold mb-1">Now Speaking</p>
          <p className="font-display text-2xl">
            {currentItem?.speaker || currentItem?.title || '—'}
          </p>
          {nextItem && (
            <p className="text-sm text-parchment/60 mt-1">
              Next: {nextItem.speaker || nextItem.title}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevious}
            disabled={busy || currentIndex <= 0}
            aria-label="Previous programme item"
            className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition disabled:opacity-40"
          >
            <SkipBack size={20} />
          </button>
          <button
            onClick={() => onAutoAdvanceChange(!autoAdvance)}
            disabled={programme.length < 2}
            aria-label={autoAdvance ? 'Pause auto-advance' : 'Start auto-advance'}
            aria-pressed={autoAdvance}
            title="Auto-advance every 60 seconds (Space)"
            className="p-3 rounded-lg bg-gold text-ink hover:bg-gold-light transition disabled:opacity-40"
          >
            {autoAdvance ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={onNext}
            disabled={busy || currentIndex >= programme.length - 1}
            aria-label="Next programme item"
            className="p-3 rounded-lg bg-white/10 hover:bg-white/20 transition disabled:opacity-40"
          >
            <SkipForward size={20} />
          </button>
        </div>
      </div>
      {programme.length > 0 && (
        <div className="mt-4 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gold transition-all duration-500"
            style={{ width: `${((currentIndex + 1) / programme.length) * 100}%` }}
          />
        </div>
      )}
      <p className="mt-3 text-xs text-parchment/45">
        {autoAdvance ? 'Auto-advance is on · next item in 60 seconds' : 'Use ←/→ to move · Space toggles auto-advance'}
      </p>
    </div>
  );
}
