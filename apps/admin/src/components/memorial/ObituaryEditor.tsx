interface ObituaryEditorProps {
  text: string;
  status: 'idle' | 'saving' | 'saved';
  onChange: (text: string) => void;
  onSave: () => void;
}

export function ObituaryEditor({ text, status, onChange, onSave }: ObituaryEditorProps) {
  return (
    <div className="bg-white rounded-xl border border-parchment-dark p-6">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted">Write the obituary for the memorial page</p>
        <div className="flex items-center gap-3">
          {status === 'saved' && (
            <span className="text-sm text-green-700">Saved</span>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={status === 'saving'}
            className="px-4 py-2 bg-ink text-parchment rounded-lg text-sm font-medium hover:bg-ink-light transition disabled:opacity-50"
          >
            {status === 'saving' ? 'Saving...' : 'Save obituary'}
          </button>
        </div>
      </div>
      <textarea
        className="w-full min-h-64 p-4 border border-parchment-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/40 resize-y"
        placeholder="Enter the obituary text..."
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onSave}
      />
      <p className="text-xs text-muted mt-2">
        Saves automatically when you click outside the text box, or use the Save button.
      </p>
    </div>
  );
}
