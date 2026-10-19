import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CreditCard, Globe, Monitor, Trash2, Gift } from 'lucide-react';
import { api, MemorialDetail } from '../../lib/api';
import { getMemorialBaseUrl, memorialPageUrl } from '../../lib/config';
import type { EntitlementSnapshot } from '@memorialconnect/shared';

interface MemorialHeaderProps {
  memorial: MemorialDetail;
  saving: boolean;
  onPublish: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

const money = (cents: number, currency = 'ZAR') =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(cents / 100);

export function MemorialHeader({ memorial, saving, onPublish, onDelete, canDelete }: MemorialHeaderProps) {
  const [openingPreview, setOpeningPreview] = useState<'page' | 'projector' | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [entitlement, setEntitlement] = useState<EntitlementSnapshot | null>(null);
  const guestBaseUrl = getMemorialBaseUrl();
  const guestMemorialUrl = memorialPageUrl(memorial.slug);

  useEffect(() => {
    if (!['DRAFT', 'PAID_PENDING'].includes(memorial.status)) return;
    api.getEntitlementStatus().then(setEntitlement).catch(() => setEntitlement(null));
  }, [memorial.status, memorial.id]);

  const openPreview = async (mode: 'page' | 'projector') => {
    setPreviewError('');
    const destination = mode === 'projector' ? `${guestMemorialUrl}/projector` : guestMemorialUrl;
    const isPublic = ['PUBLISHED', 'LOCKED'].includes(memorial.status);

    if (isPublic) {
      window.open(destination, '_blank', 'noopener,noreferrer');
      return;
    }

    const previewWindow = window.open('about:blank', '_blank');

    if (!previewWindow) {
      setPreviewError('Allow pop-ups to open the preview.');
      return;
    }

    previewWindow.opener = null;
    previewWindow.document.title = 'Preparing private preview…';
    setOpeningPreview(mode);
    try {
      const { token } = await api.getMemorialPreviewToken(memorial.id);
      previewWindow.location.href = `${destination}?preview=${encodeURIComponent(token)}`;
    } catch (error) {
      previewWindow.close();
      setPreviewError(error instanceof Error ? error.message : 'Could not open the private preview.');
    } finally {
      setOpeningPreview(null);
    }
  };

  const publishLabel = () => {
    if (saving) return 'Publishing…';
    if (memorial.status === 'PUBLISHED' || memorial.status === 'LOCKED') return 'Published';
    if (memorial.status === 'EXPIRED') return 'Viewing ended';
    if (entitlement?.mode === 'TRIAL') {
      const { freeMemorialsUsed, freeMemorialLimit } = entitlement.trial;
      return `Publish free (${freeMemorialsUsed} of ${freeMemorialLimit} trial)`;
    }
    if (entitlement?.mode === 'CREDITS') {
      return `Publish (1 credit · ${entitlement.creditsRemaining} left)`;
    }
    return `Publish for ${money(entitlement?.singleMemorialPriceCents ?? 29999, entitlement?.currency ?? 'ZAR')}`;
  };

  return (
    <>
      <Link to="/" className="mb-6 inline-flex items-center gap-1 text-sm text-muted transition hover:text-ink">
        <ArrowLeft size={16} /> Back to memorials
      </Link>

      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words font-display text-3xl text-ink">{memorial.deceasedName}</h1>
          <p className="mt-1 break-all text-sm text-muted">
            {guestBaseUrl.replace(/^https?:\/\//, '')}/{memorial.slug}
          </p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete || saving}
            title={!canDelete ? 'This funeral programme is locked because it has already been published and shared.' : 'Delete funeral'}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
          >
            <Trash2 size={16} /> Delete
          </button>
          <button
            type="button"
            onClick={() => openPreview('page')}
            disabled={openingPreview !== null}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-parchment-dark px-3 py-2 text-sm transition hover:bg-white sm:px-4"
          >
            <Globe size={16} /> {openingPreview === 'page' ? 'Opening…' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={() => openPreview('projector')}
            disabled={openingPreview !== null}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-parchment-dark px-3 py-2 text-sm transition hover:bg-white sm:px-4"
          >
            <Monitor size={16} /> {openingPreview === 'projector' ? 'Opening…' : 'Projector'}
          </button>
          <button
            type="button"
            onClick={onPublish}
            className="col-span-2 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-parchment transition hover:bg-ink-light disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-1"
            disabled={saving || !['DRAFT', 'PAID_PENDING'].includes(memorial.status)}
          >
            {entitlement?.mode === 'TRIAL' ? <Gift size={16} /> : <CreditCard size={16} />}
            {publishLabel()}
          </button>
        </div>
      </div>
      {previewError && <p className="-mt-5 mb-6 text-left text-sm text-red-700 sm:text-right">{previewError}</p>}
    </>
  );
}
