import { Tribute } from '@memorialconnect/shared';

interface TributeViewerProps {
  tributes: Tribute[];
}

export function TributeViewer({ tributes }: TributeViewerProps) {
  return (
    <div className="space-y-3">
      {tributes.length === 0 ? (
        <p className="text-muted text-center py-8">No tributes yet</p>
      ) : (
        tributes.map((t) => (
          <div key={t.id} className="bg-white rounded-lg border border-parchment-dark p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-sm">{t.authorName}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                t.approved ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {t.approved ? 'Approved' : 'Pending'}
              </span>
            </div>
            <p className="text-sm text-ink/80">{t.message}</p>
          </div>
        ))
      )}
    </div>
  );
}
