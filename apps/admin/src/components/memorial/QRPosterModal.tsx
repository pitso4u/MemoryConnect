import { useCallback, useEffect, useState } from 'react';
import { Download, FileImage, FileText, Loader2, X } from 'lucide-react';
import type { BrandProfile } from '@memorialconnect/shared';
import {
  createQrPosterCanvas,
  downloadBlob,
  formatEventDate,
  formatEventTime,
  posterCanvasToBlob,
  posterCanvasToPdfBlob,
} from '../../lib/qrPoster';

interface QRPosterMemorial {
  slug: string;
  deceasedName: string;
  serviceDate?: string | null;
  serviceVenue?: string | null;
  timezone?: string | null;
  portraitUrl?: string | null;
}

interface QRPosterModalProps {
  open: boolean;
  onClose: () => void;
  memorial: QRPosterMemorial;
  url: string;
  brand: BrandProfile;
}

export default function QRPosterModal({ open, onClose, memorial, url, brand }: QRPosterModalProps) {
  const [includeEventInfo, setIncludeEventInfo] = useState(true);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const next = await createQrPosterCanvas({
        funeralHomeName: brand.tradingName || brand.companyName,
        logoUrl: brand.logoUrl,
        portraitUrl: memorial.portraitUrl,
        memorialUrl: url,
        deceasedName: memorial.deceasedName,
        eventDateLabel: memorial.serviceDate ? formatEventDate(memorial.serviceDate, memorial.timezone || undefined) : null,
        eventTime: memorial.serviceDate ? formatEventTime(memorial.serviceDate, memorial.timezone || undefined) : null,
        eventVenue: memorial.serviceVenue,
        includeEventInfo,
      });
      setCanvas(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate the poster');
    } finally {
      setBusy(false);
    }
  }, [brand, url, memorial, includeEventInfo]);

  useEffect(() => {
    if (open) void generate();
  }, [open, generate]);

  if (!open) return null;

  const filename = `memorial-${memorial.slug}-qr-poster`;

  const downloadPdf = async () => {
    if (!canvas) return;
    setBusy(true);
    try {
      downloadBlob(await posterCanvasToPdfBlob(canvas), `${filename}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export the PDF');
    } finally {
      setBusy(false);
    }
  };

  const downloadImage = async (type: 'image/png' | 'image/jpeg', extension: 'png' | 'jpg') => {
    if (!canvas) return;
    setBusy(true);
    try {
      downloadBlob(await posterCanvasToBlob(canvas, type), `${filename}.${extension}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export the image');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="QR poster"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-muted transition hover:bg-parchment"
        >
          <X size={18} />
        </button>

        <h2 className="font-display text-2xl text-ink">QR Poster</h2>
        <p className="text-sm text-muted mb-4">
          Print-ready A4 flyer for the entrance, chairs and welcome table. The QR opens the digital memorial.
        </p>

        {error && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 rounded-lg border border-parchment-dark bg-parchment/40 p-4">
            {busy && !canvas ? (
              <div className="grid aspect-[210/297] max-h-[560px] place-items-center">
                <Loader2 size={28} className="animate-spin text-muted" />
              </div>
            ) : canvas ? (
              <div className="mx-auto aspect-[210/297] max-h-[560px] overflow-hidden rounded-sm shadow-md">
                <img src={canvas.toDataURL('image/png')} alt={`QR poster for ${memorial.deceasedName}`} className="h-full w-full object-contain" />
              </div>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-4 lg:w-72">
            <label className="flex items-start gap-3 rounded-lg bg-parchment px-4 py-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={includeEventInfo}
                onChange={(e) => setIncludeEventInfo(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-semibold">Include event details</span>
                <span className="mt-0.5 block text-xs text-muted">In Loving Memory of {memorial.deceasedName} and service details</span>
              </span>
            </label>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={downloadPdf}
                disabled={busy || !canvas}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 text-sm font-medium text-parchment transition hover:bg-ink-light disabled:opacity-50"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                Download PDF
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => downloadImage('image/png', 'png')}
                  disabled={busy || !canvas}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-parchment-dark px-4 py-2.5 text-sm text-ink transition hover:bg-parchment disabled:opacity-50"
                >
                  <FileImage size={16} /> PNG
                </button>
                <button
                  type="button"
                  onClick={() => downloadImage('image/jpeg', 'jpg')}
                  disabled={busy || !canvas}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-parchment-dark px-4 py-2.5 text-sm text-ink transition hover:bg-parchment disabled:opacity-50"
                >
                  <Download size={16} /> JPEG
                </button>
              </div>
            </div>
            <p className="text-xs text-muted">A4 portrait · 300 DPI · high-error-correction QR code.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
