import { useEffect, useState } from 'react';
import { api, FuneralFeedback, FuneralFeedbackSummary } from '../../lib/api';
import { Star, ThumbsUp, MessageSquare, TrendingUp, Users } from 'lucide-react';

function StarDisplay({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={14}
          className={i < Math.round(rating) ? 'text-gold fill-current' : 'text-parchment-dark'}
        />
      ))}
    </span>
  );
}

function RatingCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-parchment p-4">
      <p className="text-xs text-muted mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <span className="font-display text-2xl text-ink">{value.toFixed(1)}</span>
        <StarDisplay rating={value} />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-parchment p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} className="text-gold-dark" />
        <p className="text-xs text-muted">{label}</p>
      </div>
      <p className="font-display text-2xl text-ink">{value}</p>
    </div>
  );
}

export default function FuneralFeedbackPanel({ id }: { id: string }) {
  const [feedback, setFeedback] = useState<FuneralFeedback[]>([]);
  const [summary, setSummary] = useState<FuneralFeedbackSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [feedbackData, summaryData] = await Promise.all([
        api.getMemorialFeedback(id),
        api.getMemorialFeedbackSummary(id),
      ]);
      setFeedback(feedbackData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const handleStatusChange = async (feedbackId: string, contactStatus: 'NEW' | 'CONTACTED' | 'CLOSED') => {
    try {
      await api.updateFeedbackContactStatus(id, feedbackId, contactStatus);
      setFeedback((prev) =>
        prev.map((f) =>
          f.id === feedbackId
            ? { ...f, contactStatus, contactedAt: contactStatus === 'CONTACTED' ? new Date().toISOString() : null }
            : f
        )
      );
    } catch (err) {
      console.error('Failed to update status', err);
    }
  };

  if (loading) return <div className="text-muted py-8 text-center">Loading feedback...</div>;
  if (error) return <div className="text-red-600 py-8 text-center">{error}</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      {summary && summary.totalResponses > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RatingCard label="Average Rating" value={summary.averageRating} />
            <RatingCard label="Staff Professionalism" value={summary.averageStaffRating} />
            <RatingCard label="Organisation" value={summary.averageOrganisationRating} />
            <RatingCard label="Venue" value={summary.averageVenueRating} />
            <StatCard icon={Users} label="Total Responses" value={summary.totalResponses} />
            <StatCard icon={ThumbsUp} label="Would Recommend" value={`${summary.recommendPercentage}%`} />
            <StatCard icon={TrendingUp} label="Would Use Again" value={`${summary.useAgainPercentage}%`} />
          </div>
          <hr className="border-parchment-dark" />
        </>
      )}

      {summary && summary.totalResponses === 0 && (
        <div className="rounded-xl border border-parchment-dark p-8 text-center">
          <MessageSquare size={32} className="mx-auto mb-3 text-muted" />
          <p className="font-display text-lg text-ink">No feedback yet</p>
          <p className="text-sm text-muted mt-1">Responses will appear here once attendees submit feedback.</p>
        </div>
      )}

      {/* Individual responses */}
      {feedback.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-display text-xl text-ink">Responses (newest first)</h3>
          {feedback.map((f) => (
            <div key={f.id} className="rounded-xl border border-parchment-dark bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StarDisplay rating={f.overallRating} />
                    <span className="text-sm text-muted">{new Date(f.createdAt).toLocaleDateString('en-ZA')}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    {f.staffRating != null && <span>Staff: <StarDisplay rating={f.staffRating} /></span>}
                    {f.organisationRating != null && <span>Organisation: <StarDisplay rating={f.organisationRating} /></span>}
                    {f.venueRating != null && <span>Venue: <StarDisplay rating={f.venueRating} /></span>}
                  </div>
                  <div className="flex gap-3 text-xs text-muted">
                    {f.recommend != null && <span>Recommend: {f.recommend ? 'Yes' : 'No'}</span>}
                    {f.useAgain != null && <span>Use again: {f.useAgain ? 'Yes' : 'No'}</span>}
                  </div>
                </div>
              </div>
              {f.comments && (
                <p className="mt-3 text-sm text-ink/80 border-t border-parchment-dark pt-3">{f.comments}</p>
              )}
              {f.allowContact && f.name && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
                  <p className="font-medium text-amber-900 mb-1">Contact request</p>
                  <p className="text-amber-800">{f.name} — {f.phone}{f.email ? ` — ${f.email}` : ''}</p>
                  <div className="mt-2 flex gap-2">
                    {(['NEW', 'CONTACTED', 'CLOSED'] as const).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleStatusChange(f.id, status)}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                          f.contactStatus === status
                            ? status === 'NEW'
                              ? 'bg-amber-500 text-white'
                              : status === 'CONTACTED'
                              ? 'bg-blue-500 text-white'
                              : 'bg-green-500 text-white'
                            : 'bg-white border border-parchment-dark text-muted hover:bg-parchment'
                        }`}
                      >
                        {status.charAt(0) + status.slice(1).toLowerCase()}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {f.contactStatus === 'NEW' && 'Awaiting contact'}
                    {f.contactStatus === 'CONTACTED' && `Contacted ${f.contactedAt ? new Date(f.contactedAt).toLocaleDateString('en-ZA') : ''}`}
                    {f.contactStatus === 'CLOSED' && 'Resolved'}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
