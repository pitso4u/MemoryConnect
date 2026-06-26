import { Trash2 } from 'lucide-react';
import { ProgrammeItem, ProgrammeItemType } from '@memorialconnect/shared';

const PROGRAMME_TYPES = [
  { value: 'opening_prayer', label: 'Opening Prayer' },
  { value: 'scripture', label: 'Scripture Reading' },
  { value: 'hymn', label: 'Hymn' },
  { value: 'speaker', label: 'Speaker' },
  { value: 'family_tribute', label: 'Family Tribute' },
  { value: 'closing_prayer', label: 'Closing Prayer' },
  { value: 'burial', label: 'Burial' },
  { value: 'other', label: 'Other' },
] as const;

interface ProgrammeEditorProps {
  programme: ProgrammeItem[];
  currentIndex: number;
  onUpdateItem: (itemId: string, changes: Partial<ProgrammeItem>) => ProgrammeItem[];
  onSave: (programme: ProgrammeItem[]) => void;
  onAddItem: () => void;
  onRemoveItem: (itemId: string) => void;
}

export function ProgrammeEditor({
  programme,
  currentIndex,
  onUpdateItem,
  onSave,
  onAddItem,
  onRemoveItem,
}: ProgrammeEditorProps) {
  const updateAndSave = (itemId: string, changes: Partial<ProgrammeItem>) => {
    const updated = onUpdateItem(itemId, changes);
    onSave(updated);
  };

  return (
    <div className="space-y-3">
      {programme.length === 0 && (
        <p className="text-sm text-muted text-center py-6">
          No programme items yet. Add speakers, hymns, and other items below.
        </p>
      )}
      {programme.map((item, idx) => (
        <div
          key={item.id}
          className={`p-4 rounded-lg border ${
            idx === currentIndex ? 'border-gold bg-gold/5' : 'border-parchment-dark bg-white'
          }`}
        >
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-medium text-muted w-6">{idx + 1}</span>
            <select
              value={item.type}
              onChange={(e) => updateAndSave(item.id, { type: e.target.value as ProgrammeItemType })}
              className="text-sm px-3 py-1.5 border border-parchment-dark rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gold/40"
            >
              {PROGRAMME_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => onRemoveItem(item.id)}
              className="p-2 text-muted hover:text-red-600 transition rounded-lg hover:bg-red-50"
              title="Remove item"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 pl-9">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Item title</label>
              <input
                type="text"
                value={item.title}
                onChange={(e) => onUpdateItem(item.id, { title: e.target.value })}
                onBlur={(e) => updateAndSave(item.id, { title: e.target.value })}
                placeholder="e.g. Opening Remarks"
                className="w-full px-3 py-2 text-sm border border-parchment-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Speaker / person</label>
              <input
                type="text"
                value={item.speaker || ''}
                onChange={(e) => onUpdateItem(item.id, { speaker: e.target.value })}
                onBlur={(e) => updateAndSave(item.id, { speaker: e.target.value })}
                placeholder="e.g. Pastor Mokoena"
                className="w-full px-3 py-2 text-sm border border-parchment-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/40"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={onAddItem}
        className="w-full py-3 border-2 border-dashed border-parchment-dark rounded-lg text-sm text-muted hover:border-gold hover:text-gold-dark transition"
      >
        + Add programme item
      </button>
    </div>
  );
}
