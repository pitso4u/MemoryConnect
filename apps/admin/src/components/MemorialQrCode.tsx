import { useRef, useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Download, Check, Wifi } from 'lucide-react';
import { getMemorialBaseUrl, memorialPageUrl } from '../lib/config';

interface MemorialQrCodeProps {
  slug: string;
  deceasedName: string;
  demoNetworkUrl?: string;
  onSaveDemoUrl: (url: string) => Promise<void>;
}

export default function MemorialQrCode({
  slug,
  deceasedName,
  demoNetworkUrl,
  onSaveDemoUrl,
}: MemorialQrCodeProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [demoUrlInput, setDemoUrlInput] = useState(demoNetworkUrl || '');
  const [savingDemo, setSavingDemo] = useState(false);
  const [demoSaved, setDemoSaved] = useState(false);

  useEffect(() => {
    setDemoUrlInput(demoNetworkUrl || '');
  }, [demoNetworkUrl]);

  const memorialLink = memorialPageUrl(slug, demoNetworkUrl || demoUrlInput || undefined);
  const autoDetectedUrl = getMemorialBaseUrl();

  const copyLink = async () => {
    await navigator.clipboard.writeText(memorialLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQr = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `memorial-${slug}-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const saveDemoUrl = async () => {
    setSavingDemo(true);
    try {
      await onSaveDemoUrl(demoUrlInput.trim());
      setDemoSaved(true);
      setTimeout(() => setDemoSaved(false), 2000);
    } finally {
      setSavingDemo(false);
    }
  };

  const useAutoDetected = () => {
    setDemoUrlInput(autoDetectedUrl);
  };

  return (
    <div className="mt-8 bg-white rounded-xl border border-parchment-dark p-6">
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <div ref={canvasRef} className="p-3 bg-white border border-parchment-dark rounded-lg shrink-0">
          <QRCodeCanvas
            value={memorialLink}
            size={160}
            level="H"
            marginSize={2}
            fgColor="#1a1a2e"
            bgColor="#ffffff"
            title={`QR code for ${deceasedName} memorial`}
          />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-lg">QR Code</p>
          <p className="text-sm text-muted mt-1">
            Guests scan this code to open the memorial on their phone. No app required.
          </p>
          <p className="text-sm font-mono text-gold-dark mt-3 break-all">{memorialLink}</p>

          <div className="mt-5 p-4 bg-parchment/50 rounded-lg border border-parchment-dark">
            <div className="flex items-center gap-2 mb-2">
              <Wifi size={16} className="text-gold-dark" />
              <p className="text-sm font-medium">Demo Network URL</p>
            </div>
            <p className="text-xs text-muted mb-3">
              Enter your laptop&apos;s Wi-Fi IP so phones on the same router can scan the QR code.
              Example: <code className="font-mono">http://192.168.0.105:5174</code>
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={demoUrlInput}
                onChange={(e) => setDemoUrlInput(e.target.value)}
                placeholder={`e.g. ${autoDetectedUrl}`}
                className="flex-1 px-3 py-2 text-sm border border-parchment-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/40 font-mono"
              />
              <button
                type="button"
                onClick={useAutoDetected}
                className="px-3 py-2 text-sm border border-parchment-dark rounded-lg hover:bg-white transition whitespace-nowrap"
              >
                Use detected
              </button>
              <button
                type="button"
                onClick={saveDemoUrl}
                disabled={savingDemo}
                className="px-4 py-2 text-sm bg-ink text-parchment rounded-lg hover:bg-ink-light transition disabled:opacity-50 whitespace-nowrap"
              >
                {savingDemo ? 'Saving...' : demoSaved ? 'Saved' : 'Save URL'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-2 px-4 py-2 border border-parchment-dark rounded-lg text-sm hover:bg-parchment transition"
            >
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <button
              type="button"
              onClick={downloadQr}
              className="inline-flex items-center gap-2 px-4 py-2 bg-ink text-parchment rounded-lg text-sm hover:bg-ink-light transition"
            >
              <Download size={16} />
              Download QR
            </button>
          </div>

          {!demoNetworkUrl && !demoUrlInput && memorialLink.includes('localhost') && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
              QR points to localhost — phones cannot open that. Set a Demo Network URL above using your
              laptop IP from <code className="font-mono">ipconfig</code>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
