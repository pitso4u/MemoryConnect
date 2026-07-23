import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, FamilyAccess, FamilyInvitation, MemorialAnalytics, MemorialDetail, ProgrammeItem } from '../lib/api';
import MemorialQrCode from '../components/MemorialQrCode';
import FuneralFeedbackPanel from '../components/memorial/FuneralFeedbackPanel';
import { MemorialHeader } from '../components/memorial/MemorialHeader';
import { ProjectorControls } from '../components/memorial/ProjectorControls';
import { ProgrammeEditor } from '../components/memorial/ProgrammeEditor';
import { PhotoManager } from '../components/memorial/PhotoManager';
import { ObituaryEditor } from '../components/memorial/ObituaryEditor';
import { TributeViewer } from '../components/memorial/TributeViewer';
import { LocationManager } from '../components/memorial/LocationManager';
import { BarChart3, Copy, ExternalLink, Eye, FileText, Image, Lock, Mail, MapPinned, MessageSquare, Send, Star, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { memorialPageUrl } from '../lib/config';

type DetailTab = 'programme' | 'obituary' | 'photos' | 'locations' | 'tributes' | 'feedback';

function isFamilyRole(role?: string) {
  return role === 'FAMILY_MANAGER' || role === 'FAMILY_CONTRIBUTOR';
}

function canManageFamilyInvites(role?: string) {
  return role === 'SUPER_ADMIN' || role === 'FUNERAL_HOME_ADMIN';
}

export default function MemorialDetailPage({ initialTab = 'programme' }: { initialTab?: DetailTab }) {
  const { user } = useAuth();
  const { setPreviewBrand } = useBrand();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [memorial, setMemorial] = useState<MemorialDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DetailTab>(initialTab);
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
  const [programmeControlBusy, setProgrammeControlBusy] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteContact, setInviteContact] = useState('');
  const [inviteRole, setInviteRole] = useState<'FAMILY_MANAGER' | 'FAMILY_CONTRIBUTOR'>('FAMILY_MANAGER');
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteEmailTarget, setInviteEmailTarget] = useState('');
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [familyAccess, setFamilyAccess] = useState<FamilyAccess[]>([]);
  const [familyInvitations, setFamilyInvitations] = useState<FamilyInvitation[]>([]);
  const [inviteError, setInviteError] = useState('');
  const [resetLink, setResetLink] = useState('');

  const familyUser = isFamilyRole(user?.role);
  const funeralHomeAdmin = canManageFamilyInvites(user?.role);

  const load = () => {
    if (!id) return;
    api.getMemorial(id)
      .then(setMemorial)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  useEffect(() => {
    if (memorial?.funeralHome?.brand) setPreviewBrand(memorial.funeralHome.brand);
  }, [memorial?.id, memorial?.funeralHome?.brand]);

  useEffect(() => setActiveTab(initialTab), [initialTab]);

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
    if (familyUser || !id || !memorial || !['PUBLISHED', 'LOCKED', 'EXPIRED'].includes(memorial.status)) return;
    api.getMemorialAnalytics(id).then(setAnalytics).catch(() => undefined);
  }, [familyUser, id, memorial?.status, memorial?.viewCount]);

  useEffect(() => {
    if (!id || !funeralHomeAdmin) return;
    void Promise.all([
      api.getFamilyAccess(id).then(setFamilyAccess),
      api.getFamilyInvitations(id).then(setFamilyInvitations),
    ]).catch(() => undefined);
  }, [id, funeralHomeAdmin]);

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
      navigate('/dashboard');
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Could not delete funeral');
      setSaving(false);
    }
  };

  const handleProgrammeControl = async (action: 'next' | 'previous') => {
    if (!id || programmeControlBusy) return;
    const fn = action === 'next' ? api.programmeNext : api.programmePrevious;
    setProgrammeControlBusy(true);
    try {
      const updated = await fn(id);
      setMemorial((prev) => prev ? { ...prev, currentProgrammeIndex: updated.currentProgrammeIndex } : prev);
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : 'Could not move the live programme');
      setAutoAdvance(false);
    } finally {
      setProgrammeControlBusy(false);
    }
  };

  useEffect(() => {
    if (!autoAdvance || !memorial || memorial.currentProgrammeIndex >= memorial.programme.length - 1) return;
    const interval = window.setInterval(() => void handleProgrammeControl('next'), 60_000);
    return () => window.clearInterval(interval);
  }, [autoAdvance, memorial?.currentProgrammeIndex, memorial?.programme.length, id, programmeControlBusy]);

  useEffect(() => {
    if (!autoAdvance || !memorial || memorial.currentProgrammeIndex < memorial.programme.length - 1) return;
    setAutoAdvance(false);
  }, [autoAdvance, memorial?.currentProgrammeIndex, memorial?.programme.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight') void handleProgrammeControl('next');
      else if (event.key === 'ArrowLeft') void handleProgrammeControl('previous');
      else if (event.code === 'Space') {
        event.preventDefault();
        setAutoAdvance((enabled) => !enabled);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [id, programmeControlBusy]);

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

  const copyInviteLink = async (url: string, idForMessage = 'latest') => {
    await navigator.clipboard?.writeText(url);
    setCopiedInviteId(idForMessage);
    window.setTimeout(() => setCopiedInviteId((current) => current === idForMessage ? null : current), 2500);
  };

  const handleInviteFamily = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!id) return;
    setInviteError('');
    setInviteUrl('');
    const isEmail = inviteContact.includes('@');
    try {
      const invitation = await api.createFamilyInvitation(id, {
        name: inviteName,
        role: inviteRole,
        email: isEmail ? inviteContact : undefined,
        phone: isEmail ? undefined : inviteContact,
      });
      setInviteUrl(invitation.inviteUrl || '');
      setInviteEmailTarget(invitation.email || '');
      setFamilyInvitations((current) => [invitation, ...current]);
      setInviteName('');
      setInviteContact('');
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Could not create invitation');
    }
  };

  const handleResendInvite = async (invitationId: string) => {
    if (!id) return;
    const invitation = await api.resendFamilyInvitation(id, invitationId);
    setFamilyInvitations((current) => current.map((item) => item.id === invitationId ? invitation : item));
    if (invitation.inviteUrl) setInviteUrl(invitation.inviteUrl);
  };

  const handleRevokeInvite = async (invitationId: string) => {
    if (!id) return;
    await api.revokeFamilyInvitation(id, invitationId);
    setFamilyInvitations((current) => current.filter((item) => item.id !== invitationId));
  };

  const handleRevokeFamilyAccess = async (accessId: string) => {
    if (!id) return;
    await api.revokeFamilyAccess(id, accessId);
    setFamilyAccess((current) => current.filter((item) => item.id !== accessId));
  };

  const handlePasswordReset = async (accessId: string) => {
    if (!id) return;
    const result = await api.sendFamilyPasswordReset(id, accessId);
    setResetLink(result.resetUrl);
    if (result.resetUrl) await copyInviteLink(result.resetUrl, `reset-${accessId}`);
  };

  const openFamilyPreview = async () => {
    if (!id || !memorial) return;
    const previewWindow = window.open('about:blank', '_blank');
    if (!previewWindow) return;
    const { token } = await api.getMemorialPreviewToken(id);
    previewWindow.opener = null;
    previewWindow.location.href = `${memorialPageUrl(memorial.slug, memorial.settings?.demoNetworkUrl)}?preview=${encodeURIComponent(token)}`;
  };

  if (loading) return <div className="p-8 text-muted">Loading...</div>;
  if (!memorial) return <div className="p-8 text-red-600">Memorial not found</div>;

  const locked = memorial.status === 'LOCKED' || Boolean(memorial.editLocksAt && new Date(memorial.editLocksAt) <= new Date());
  const canDelete = !familyUser && (['DRAFT', 'PAID_PENDING'].includes(memorial.status) || (memorial.status === 'PUBLISHED' && !locked));

  const demoNetworkUrl = memorial.settings?.demoNetworkUrl;

  const saveDemoNetworkUrl = async (url: string) => {
    if (!id || !memorial) return;
    const settings = { ...(memorial.settings || {}), demoNetworkUrl: url || undefined };
    const updated = await api.updateMemorial(id, { settings } as Partial<MemorialDetail>);
    setMemorial({ ...memorial, settings: updated.settings as MemorialDetail['settings'] });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {!familyUser && <MemorialHeader memorial={memorial} saving={saving} onPublish={handlePublish} onDelete={handleDelete} canDelete={canDelete} />}
      {familyUser && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-display text-3xl text-ink">{memorial.deceasedName}</h1>
            <p className="mt-1 text-muted">Family contributor access</p>
          </div>
          <button type="button" onClick={openFamilyPreview} className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-parchment">
            <Eye size={16} /> Preview public memorial
          </button>
        </div>
      )}

      {funeralHomeAdmin && (
        <section className="mb-6 rounded-xl border border-parchment-dark bg-white p-5">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-gold-dark" />
            <h2 className="font-display text-xl text-ink">Invite Family</h2>
          </div>
          <form onSubmit={handleInviteFamily} className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_220px_auto]">
            <input value={inviteName} onChange={(e) => setInviteName(e.target.value)} required placeholder="Family member name" className="rounded-lg border border-parchment-dark px-3 py-2 text-sm outline-none focus:border-gold" />
            <input value={inviteContact} onChange={(e) => setInviteContact(e.target.value)} required placeholder="Email or phone" className="rounded-lg border border-parchment-dark px-3 py-2 text-sm outline-none focus:border-gold" />
            <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)} className="rounded-lg border border-parchment-dark px-3 py-2 text-sm outline-none focus:border-gold">
              <option value="FAMILY_MANAGER">Family Manager</option>
              <option value="FAMILY_CONTRIBUTOR">Family Contributor</option>
            </select>
            <button className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-parchment">Invite</button>
          </form>
          {inviteError && <p className="mt-3 text-sm text-red-600">{inviteError}</p>}
          {inviteUrl && (
            <div className="mt-4 rounded-lg border border-parchment-dark bg-parchment/50 p-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">Invite link</label>
              <input readOnly value={inviteUrl} className="mt-1 w-full rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm text-ink" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => copyInviteLink(inviteUrl)} className="inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-parchment"><Copy size={15} /> Copy Link</button>
                <a href={inviteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm font-semibold text-ink"><ExternalLink size={15} /> Open Link</a>
                <a href={`https://wa.me/?text=${encodeURIComponent(inviteUrl)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm font-semibold text-ink"><Send size={15} /> Share via WhatsApp</a>
                {inviteEmailTarget && <a href={`mailto:${inviteEmailTarget}?subject=${encodeURIComponent('Family memorial invitation')}&body=${encodeURIComponent(inviteUrl)}`} className="inline-flex items-center gap-2 rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm font-semibold text-ink"><Mail size={15} /> Send by Email</a>}
              </div>
              {copiedInviteId === 'latest' && <p className="mt-2 text-sm text-green-700">Invite link copied</p>}
            </div>
          )}
          {familyInvitations.length > 0 && (
            <div className="mt-5 overflow-x-auto rounded-lg border border-parchment-dark">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-parchment text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2">Invited name</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Email / phone</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-parchment-dark bg-white">
                  {familyInvitations.map((invitation) => (
                    <tr key={invitation.id}>
                      <td className="px-3 py-3 font-medium text-ink">{invitation.name}</td>
                      <td className="px-3 py-3">{invitation.role.replace('FAMILY_', '').toLowerCase()}</td>
                      <td className="px-3 py-3">{invitation.email || invitation.phone}</td>
                      <td className="px-3 py-3">{invitation.status || 'Pending'}</td>
                      <td className="px-3 py-3 text-xs text-muted">
                        <div>{invitation.accountStatus || 'Invitation pending'}</div>
                        <div>{invitation.passwordSet ? 'Password set: Yes' : 'Password not set yet'}</div>
                        <div>Last login: {invitation.lastLoginAt ? new Date(invitation.lastLoginAt).toLocaleString('en-ZA') : 'Never'}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          {invitation.inviteUrl && <button type="button" onClick={() => copyInviteLink(invitation.inviteUrl!, invitation.id)} className="inline-flex items-center gap-1.5 text-gold-dark hover:text-gold"><Copy size={14} /> Copy</button>}
                          <button type="button" onClick={() => handleResendInvite(invitation.id)} className="text-ink hover:text-gold-dark">Resend invite</button>
                          <button type="button" onClick={() => handleRevokeInvite(invitation.id)} className="text-red-600 hover:text-red-700">Revoke invite</button>
                        </div>
                        {copiedInviteId === invitation.id && <p className="mt-1 text-xs text-green-700">Invite link copied</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {familyAccess.length > 0 && (
            <div className="mt-5 divide-y divide-parchment-dark rounded-lg border border-parchment-dark bg-white text-sm">
              {familyAccess.map((access) => (
                <div key={access.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="min-w-0">
                    {access.user.name} - {access.user.email} - {access.role.replace('FAMILY_', '').toLowerCase()}
                    <span className="ml-2 text-xs text-muted">
                      Password set: {access.user.passwordSetAt ? 'Yes' : 'No'} - Last login: {access.user.lastLoginAt ? new Date(access.user.lastLoginAt).toLocaleString('en-ZA') : 'Never'}
                    </span>
                  </span>
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={() => handlePasswordReset(access.id)} className="text-gold-dark hover:text-gold">Send password reset link</button>
                    <button type="button" onClick={() => handleRevokeFamilyAccess(access.id)} className="text-red-600 hover:text-red-700">Revoke access</button>
                  </div>
                  {copiedInviteId === `reset-${access.id}` && <p className="text-xs text-green-700">Reset link copied</p>}
                </div>
              ))}
            </div>
          )}
          {resetLink && (
            <div className="mt-4 rounded-lg border border-parchment-dark bg-parchment/50 p-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted">Password reset link</label>
              <input readOnly value={resetLink} className="mt-1 w-full rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm text-ink" />
            </div>
          )}
          {false && (
            <div className="mt-4 divide-y divide-parchment-dark text-sm">
              {familyAccess.map((access) => (
                <div key={access.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0 truncate">{access.user.name} · {access.user.email} · {access.role.replace('FAMILY_', '').toLowerCase()}</span>
                  <button type="button" onClick={() => handleRevokeFamilyAccess(access.id)} className="text-red-600 hover:text-red-700">Revoke</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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
      {!familyUser && <ProjectorControls
        programme={memorial.programme}
        currentIndex={memorial.currentProgrammeIndex}
        onNext={() => handleProgrammeControl('next')}
        onPrevious={() => handleProgrammeControl('previous')}
        autoAdvance={autoAdvance}
        onAutoAdvanceChange={setAutoAdvance}
        busy={programmeControlBusy}
      />}

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-parchment-dark">
        {([
          { key: 'programme', label: 'Programme', icon: FileText },
          { key: 'obituary', label: 'Obituary', icon: FileText },
          { key: 'photos', label: 'Photos', icon: Image },
          { key: 'locations', label: 'Locations & Directions', icon: MapPinned },
          { key: 'tributes', label: 'Tributes', icon: MessageSquare },
          { key: 'feedback', label: 'Funeral Feedback', icon: Star },
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

      {activeTab === 'feedback' && (
        <FuneralFeedbackPanel id={memorial.id} />
      )}
      </div>

      {!familyUser && ['PUBLISHED', 'LOCKED'].includes(memorial.status) && <MemorialQrCode
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
