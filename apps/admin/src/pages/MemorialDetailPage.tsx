import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, MemorialAnalytics, MemorialDetail, ProgrammeItem } from '../lib/api';
import MemorialQrCode from '../components/MemorialQrCode';
import { MemorialHeader } from '../components/memorial/MemorialHeader';
import { ProjectorControls } from '../components/memorial/ProjectorControls';
import { ProgrammeEditor } from '../components/memorial/ProgrammeEditor';
import { PhotoManager } from '../components/memorial/PhotoManager';
import { ObituaryEditor } from '../components/memorial/ObituaryEditor';
import { TributeViewer } from '../components/memorial/TributeViewer';
import { LocationManager } from '../components/memorial/LocationManager';
import { BarChart3, Eye, FileText, Image, Lock, MapPinned, MessageSquare } from 'lucide-react';

export default function MemorialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [memorial, setMemorial] = useState<MemorialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'programme' | 'obituary' | 'photos' | 'locations' | 'tributes'>('programme');
  const [saving, setSaving] = useState(false);
  const [obituaryText, setObituaryText] = useState('');
  const [obituaryStatus, setObituaryStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [photoCategory, setPhotoCategory] = useState('family');
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [publishError, setPublishError] = useState('');
  const [analytics, setAnalytics] = useState<MemorialAnalytics | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');

  const load = () => {
    if (!id) return;
    api.getMemorial(id)
      .then(setMemorial)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  useEffect(() => {
    if (!id) return;
    const reference = new URLSearchParams(window.location.search).get('reference');
    if (!reference) return;
    setSaving(true);
    setPaymentMessage('Verifying your Paystack payment...');
    api.verifyPublishPayment(id, reference)
      .then((updated) => {
        setMemorial((current) => current ? { ...current, ...updated } : current);
        setPaymentMessage('Payment verified. This funeral is now public.');
        window.history.replaceState({}, '', window.location.pathname);
      })
      .catch((error) => setPublishError(error instanceof Error ? error.message : 'Payment could not be verified'))
      .finally(() => setSaving(false));
  }, [id]);

  useEffect(() => {
    if (!id || !memorial || !['PUBLISHED', 'LOCKED', 'EXPIRED'].includes(memorial.status)) return;
    api.getMemorialAnalytics(id).then(setAnalytics).catch(() => undefined);
  }, [id, memorial?.status, memorial?.viewCount]);

  useEffect(() => {
    if (memorial) setObituaryText(memorial.obituary || '');
  }, [memorial?.id, memorial?.obituary]);

  const saveObituary = async () => {
    if (!id || !memorial) return;
    setObituaryStatus('saving');
    try {
      await api.updateMemorial(id, { obituary: obituaryText } as Partial<MemorialDetail>);
      setMemorial({ ...memorial, obituary: obituaryText });
      setObituaryStatus('saved');
      setTimeout(() => setObituaryStatus('idle'), 2000);
    } catch (err) {
      console.error(err);
      setObituaryStatus('idle');
    }
  };

  const handlePublish = async () => {
    if (!id || !memorial) return;
    setSaving(true);
    setPublishError('');
    try {
      const checkout = await api.initializePublishPayment(id);
      window.location.assign(checkout.authorizationUrl);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Could not update publishing status');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !memorial) return;
    if (!window.confirm(`Permanently delete the funeral for ${memorial.deceasedName}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await api.deleteMemorial(id);
      navigate('/');
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Could not delete funeral');
      setSaving(false);
    }
  };

  const handleProgrammeControl = async (action: 'next' | 'previous') => {
    if (!id) return;
    const fn = action === 'next' ? api.programmeNext : api.programmePrevious;
    const updated = await fn(id);
    setMemorial((prev) => prev ? { ...prev, currentProgrammeIndex: updated.currentProgrammeIndex } : prev);
  };

  const saveProgramme = async (programme: ProgrammeItem[]) => {
    if (!id || !memorial) return;
    const updated = await api.updateMemorial(id, { programme } as Partial<MemorialDetail>);
    setMemorial({ ...memorial, programme: updated.programme as ProgrammeItem[] });
  };

  const updateProgrammeItem = (itemId: string, changes: Partial<ProgrammeItem>): ProgrammeItem[] => {
    if (!memorial) return [];
    const programme = memorial.programme.map((item) =>
      item.id === itemId ? { ...item, ...changes } : item
    );
    setMemorial({ ...memorial, programme });
    return programme;
  };

  const addProgrammeItem = async () => {
    if (!id || !memorial) return;
    const newItem: ProgrammeItem = {
      id: crypto.randomUUID(),
      type: 'speaker',
      title: '',
      speaker: '',
      order: memorial.programme.length,
    };
    const programme = [...memorial.programme, newItem];
    setMemorial({ ...memorial, programme });
    await saveProgramme(programme);
  };

  const removeProgrammeItem = async (itemId: string) => {
    if (!memorial) return;
    const programme = memorial.programme
      .filter((item) => item.id !== itemId)
      .map((item, idx) => ({ ...item, order: idx }));
    setMemorial({ ...memorial, programme });
    await saveProgramme(programme);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !memorial || !e.target.files?.length) return;
    setUploadError('');
    setUploading(true);
    try {
      const newPhotos = await api.uploadPhotos(id, e.target.files, photoCategory, photoCaption || undefined);
      setMemorial({ ...memorial, photos: [...memorial.photos, ...newPhotos] });
      setPhotoCaption('');
      e.target.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handlePhotoDelete = async (photoId: string) => {
    if (!id || !memorial) return;
    await api.deletePhoto(id, photoId);
    setMemorial({ ...memorial, photos: memorial.photos.filter((p) => p.id !== photoId) });
  };

  if (loading) return <div className="p-8 text-muted">Loading...</div>;
  if (!memorial) return <div className="p-8 text-red-600">Memorial not found</div>;

  const locked = memorial.status === 'LOCKED' || Boolean(memorial.editLocksAt && new Date(memorial.editLocksAt) <= new Date());
  const canDelete = ['DRAFT', 'PAID_PENDING'].includes(memorial.status) || (memorial.status === 'PUBLISHED' && !locked);

  const demoNetworkUrl = memorial.settings?.demoNetworkUrl;

  const saveDemoNetworkUrl = async (url: string) => {
    if (!id || !memorial) return;
    const settings = { ...(memorial.settings || {}), demoNetworkUrl: url || undefined };
    const updated = await api.updateMemorial(id, { settings } as Partial<MemorialDetail>);
    setMemorial({ ...memorial, settings: updated.settings as MemorialDetail['settings'] });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <MemorialHeader memorial={memorial} saving={saving} onPublish={handlePublish} onDelete={handleDelete} canDelete={canDelete} />

      {memorial.publicExpiresAt && ['PUBLISHED', 'LOCKED'].includes(memorial.status) && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Public viewing is available until {new Date(memorial.publicExpiresAt).toLocaleDateString('en-ZA')}.
        </div>
      )}

      {locked && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Lock size={17} /> This funeral programme is locked because it has already been published and shared.
        </div>
      )}

      {paymentMessage && <div className="mb-6 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-ink">{paymentMessage}</div>}

      {publishError && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>{publishError}</span>
          <span className="font-semibold">Publish each funeral for R299.99</span>
        </div>
      )}

      {/* Live Control Bar */}
      {!locked && <ProjectorControls
          programme={memorial.programme}
          currentIndex={memorial.currentProgrammeIndex}
          onNext={() => handleProgrammeControl('next')}
          onPrevious={() => handleProgrammeControl('previous')}
        />}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-parchment-dark">
        {([
          { key: 'programme', label: 'Programme', icon: FileText },
          { key: 'obituary', label: 'Obituary', icon: FileText },
          { key: 'photos', label: 'Photos', icon: Image },
          { key: 'locations', label: 'Locations & Directions', icon: MapPinned },
          { key: 'tributes', label: 'Tributes', icon: MessageSquare },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition -mb-px ${
              activeTab === key
                ? 'border-gold text-ink'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className={locked ? 'pointer-events-none opacity-60' : ''} aria-disabled={locked}>
      {activeTab === 'programme' && (
        <ProgrammeEditor
          programme={memorial.programme}
          currentIndex={memorial.currentProgrammeIndex}
          onUpdateItem={updateProgrammeItem}
          onSave={saveProgramme}
          onAddItem={addProgrammeItem}
          onRemoveItem={removeProgrammeItem}
        />
      )}

      {activeTab === 'obituary' && (
        <ObituaryEditor
          text={obituaryText}
          status={obituaryStatus}
          onChange={setObituaryText}
          onSave={saveObituary}
        />
      )}

      {activeTab === 'photos' && (
        <PhotoManager
          photos={memorial.photos}
          category={photoCategory}
          caption={photoCaption}
          uploading={uploading}
          uploadError={uploadError}
          onCategoryChange={setPhotoCategory}
          onCaptionChange={setPhotoCaption}
          onUpload={handlePhotoUpload}
          onDelete={handlePhotoDelete}
        />
      )}

      {activeTab === 'locations' && (
        <LocationManager
          memorialId={memorial.id}
          locations={memorial.locations || []}
          onChange={(locations) => setMemorial({ ...memorial, locations })}
        />
      )}

      {activeTab === 'tributes' && (
        <TributeViewer tributes={memorial.tributes} />
      )}
      </div>

      {['PUBLISHED', 'LOCKED'].includes(memorial.status) && <MemorialQrCode
        slug={memorial.slug}
        deceasedName={memorial.deceasedName}
        demoNetworkUrl={demoNetworkUrl}
        onSaveDemoUrl={saveDemoNetworkUrl}
      />}

      {analytics && (
        <section className="mt-8 rounded-2xl border border-parchment-dark bg-white p-6">
          <div className="flex items-center gap-2"><BarChart3 size={19} className="text-gold-dark" /><h2 className="font-display text-2xl text-ink">Public viewing</h2></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {[['Total views', analytics.totalViews], ['Views today', analytics.viewsToday], ['Last 7 days', analytics.viewsLast7Days]].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-parchment p-4"><p className="flex items-center gap-1.5 text-xs text-muted"><Eye size={13} />{label}</p><p className="mt-2 font-display text-3xl text-ink">{value}</p></div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
