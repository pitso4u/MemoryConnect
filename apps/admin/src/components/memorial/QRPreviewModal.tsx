import { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { X, Copy, Download, Check } from 'lucide-react';

interface QRPreviewModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  slug: string;
  deceasedName: string;
}

export default function QRPreviewModal({ open, onClose, url, slug, deceasedName }: QRPreviewModalProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadPng = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `memorial-${slug}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const downloadSvg = () => {
    const svg = canvasRef.current?.querySelector('svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const link = document.createElement('a');
    link.download = `memorial-${slug}-qr.svg`;
    link.href = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgString)}`;
    link.click();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="QR code preview"
    >
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 grid size-8 place-items-center rounded-full text-muted transition hover:bg-parchment"
        >
          <X size={18} />
        </button>

        <h2 className="font-display text-xl text-ink mb-1">QR Code</h2>
        <p className="text-sm text-muted mb-4">{deceasedName}</p>

        <div ref={canvasRef} className="flex justify-center mb-4">
          <QRCodeCanvas
            value={url}
            size={200}
            level="H"
            marginSize={2}
            fgColor="#1a1a2e"
            bgColor="#ffffff"
            title={`QR code for ${deceasedName}`}
          />
        </div>

        <p className="text-xs text-muted text-center break-all mb-4">{url}</p>

        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            onClick={downloadPng}
            className="inline-flex items-center gap-2 px-4 py-2 border border-parchment-dark rounded-lg text-sm hover:bg-parchment transition"
          >
            <Download size={16} />
            Download PNG
          </button>
          <button
            type="button"
            onClick={downloadSvg}
            className="inline-flex items-center gap-2 px-4 py-2 border border-parchment-dark rounded-lg text-sm hover:bg-parchment transition"
          >
            <Download size={16} />
            Download SVG
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-parchment rounded-lg text-sm hover:bg-ink-light transition"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
