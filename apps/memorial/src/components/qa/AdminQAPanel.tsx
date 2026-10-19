import { useState } from 'react';
import { CheckCircle, XCircle, ExternalLink, Edit3 } from 'lucide-react';
import { getAdminUrl } from '../../lib/config';

interface QASection {
  key: string;
  label: string;
  present: boolean;
}

interface AdminQAPanelProps {
  sections: QASection[];
  memorialId: string;
  status: string;
}

export default function AdminQAPanel({ sections, memorialId, status }: AdminQAPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const isDraft = status === 'DRAFT';

  const openAdmin = () => {
    window.open(getAdminUrl(`/memorial/${memorialId}`), '_blank', 'noopener,noreferrer');
  };

  const editMemorial = () => {
    window.open(getAdminUrl(`/memorial/${memorialId}`), '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      {isDraft && (
        <div className="sticky top-0 z-50 bg-amber-500 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-amber-950 shadow-lg">
          PREVIEW MODE &middot; Only administrators can view this memorial.
        </div>
      )}

      {/* Desktop: fixed panel */}
      <div className="hidden md:block">
        <div
          className={`fixed bottom-4 right-4 z-50 w-72 rounded-2xl border border-parchment-dark bg-white shadow-2xl transition-all ${
            expanded ? '' : 'w-auto'
          }`}
        >
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">MemoryConnect QA</span>
            <span className="text-xs text-muted">{expanded ? '▲' : '◀'}</span>
          </button>

          {expanded && (
            <div className="border-t border-parchment-dark px-4 py-3">
              <div className="space-y-1.5">
                {sections.map((section) => (
                  <div key={section.key} className="flex items-center gap-2 text-sm">
                    {section.present ? (
                      <CheckCircle size={14} className="shrink-0 text-green-600" />
                    ) : (
                      <XCircle size={14} className="shrink-0 text-red-400" />
                    )}
                    <span className={section.present ? 'text-ink' : 'text-muted'}>
                      {section.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={openAdmin}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-parchment-dark px-3 py-2 text-xs font-medium text-ink transition hover:bg-parchment"
                >
                  <ExternalLink size={13} />
                  Open Admin
                </button>
                <button
                  type="button"
                  onClick={editMemorial}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-medium text-parchment transition hover:bg-ink-light"
                >
                  <Edit3 size={13} />
                  Edit Memorial
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile: bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="rounded-t-2xl border border-parchment-dark bg-white shadow-2xl">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex w-full items-center justify-between px-4 py-3"
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">MemoryConnect QA</span>
            <span className="text-xs text-muted">{expanded ? '▼' : '▲'}</span>
          </button>

          {expanded && (
            <div className="border-t border-parchment-dark px-4 py-3 pb-6">
              <div className="space-y-1.5">
                {sections.map((section) => (
                  <div key={section.key} className="flex items-center gap-2 text-sm">
                    {section.present ? (
                      <CheckCircle size={14} className="shrink-0 text-green-600" />
                    ) : (
                      <XCircle size={14} className="shrink-0 text-red-400" />
                    )}
                    <span className={section.present ? 'text-ink' : 'text-muted'}>
                      {section.label}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={openAdmin}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-parchment-dark px-3 py-2 text-xs font-medium text-ink transition hover:bg-parchment"
                >
                  <ExternalLink size={13} />
                  Open Admin
                </button>
                <button
                  type="button"
                  onClick={editMemorial}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-medium text-parchment transition hover:bg-ink-light"
                >
                  <Edit3 size={13} />
                  Edit Memorial
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
