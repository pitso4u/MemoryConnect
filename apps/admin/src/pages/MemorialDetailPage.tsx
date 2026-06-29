import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, MemorialDetail, ProgrammeItem } from '../lib/api';
import MemorialQrCode from '../components/MemorialQrCode';
import { MemorialHeader } from '../components/memorial/MemorialHeader';
import { ProjectorControls } from '../components/memorial/ProjectorControls';
import { ProgrammeEditor } from '../components/memorial/ProgrammeEditor';
import { PhotoManager } from '../components/memorial/PhotoManager';
import { ObituaryEditor } from '../components/memorial/ObituaryEditor';
import { TributeViewer } from '../components/memorial/TributeViewer';
import { LocationManager } from '../components/memorial/LocationManager';
import { FileText, Image, MapPinned, MessageSquare } from 'lucide-react';

export default function MemorialDetailPage() {
  const { id } = useParams<{ id: string }>();
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

  const load = () => {
    if (!id) return;
    api.getMemorial(id)
      .then(setMemorial)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

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
    try {
      const updated = await api.updateMemorial(id, {
        status: memorial.status === 'published' ? 'draft' : 'published',
      } as Partial<MemorialDetail>);
      setMemorial({ ...memorial, status: updated.status });
    } catch (err) {
      console.error(err);
    } finally {
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

  const demoNetworkUrl = memorial.settings?.demoNetworkUrl;

  const saveDemoNetworkUrl = async (url: string) => {
    if (!id || !memorial) return;
    const settings = { ...(memorial.settings || {}), demoNetworkUrl: url || undefined };
    const updated = await api.updateMemorial(id, { settings } as Partial<MemorialDetail>);
    setMemorial({ ...memorial, settings: updated.settings as MemorialDetail['settings'] });
  };

  return (
    <div className="p-8">
      <MemorialHeader memorial={memorial} saving={saving} onPublish={handlePublish} />

      {/* Live Control Bar */}
      <ProjectorControls
        programme={memorial.programme}
        currentIndex={memorial.currentProgrammeIndex}
        onNext={() => handleProgrammeControl('next')}
        onPrevious={() => handleProgrammeControl('previous')}
      />

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

      <MemorialQrCode
        slug={memorial.slug}
        deceasedName={memorial.deceasedName}
        demoNetworkUrl={demoNetworkUrl}
        onSaveDemoUrl={saveDemoNetworkUrl}
      />
    </div>
  );
}
