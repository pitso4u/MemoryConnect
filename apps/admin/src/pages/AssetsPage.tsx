import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Building2, Calendar, Camera, Check, Download,
  Edit2, FileText, Loader2, MapPin, Package, Plus, QrCode, Search, Tag, Trash2, Upload, User,
} from 'lucide-react';
import { Asset, AssetDashboard, assetApi, photoUrl } from '../lib/api';

const ASSET_CATEGORIES = [
  'Tent', 'Chair', 'Table', 'Stretcher', 'Lowering Device', 'Sound System', 'Generator',
  'Coffin Trolley', 'Gazebo', 'Flowers', 'Flags', 'Display Screen', 'Projector', 'Lighting', 'Office Equipment',
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Tent: 'bg-amber-100 text-amber-700', Chair: 'bg-blue-100 text-blue-700', Table: 'bg-cyan-100 text-cyan-700',
  Stretcher: 'bg-red-100 text-red-700', 'Lowering Device': 'bg-purple-100 text-purple-700',
  'Sound System': 'bg-indigo-100 text-indigo-700', Generator: 'bg-orange-100 text-orange-700',
  'Coffin Trolley': 'bg-rose-100 text-rose-700', Gazebo: 'bg-teal-100 text-teal-700',
  Flowers: 'bg-pink-100 text-pink-700', Flags: 'bg-violet-100 text-violet-700',
  'Display Screen': 'bg-sky-100 text-sky-700', Projector: 'bg-fuchsia-100 text-fuchsia-700',
  Lighting: 'bg-yellow-100 text-yellow-700', 'Office Equipment': 'bg-gray-100 text-gray-700',
};

const CONDITION_OPTIONS = ['New', 'Good', 'Fair', 'Poor', 'Damaged'];
const STATUS_OPTIONS = ['Available', 'Reserved', 'In Use', 'Maintenance', 'Retired'];
const SEVERITY_OPTIONS = ['Low', 'Medium', 'High', 'Critical'];
const REPORT_STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Closed'];

function statusColor(status: string) {
  switch (status) {
    case 'Available': return 'bg-emerald-100 text-emerald-700';
    case 'Reserved': return 'bg-blue-100 text-blue-700';
    case 'In Use': return 'bg-amber-100 text-amber-700';
    case 'Maintenance': return 'bg-orange-100 text-orange-700';
    case 'Retired': return 'bg-gray-100 text-gray-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function conditionColor(cond: string) {
  switch (cond) {
    case 'New': return 'bg-emerald-100 text-emerald-700';
    case 'Good': return 'bg-blue-100 text-blue-700';
    case 'Fair': return 'bg-amber-100 text-amber-700';
    case 'Poor': return 'bg-orange-100 text-orange-700';
    case 'Damaged': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function severityColor(sev: string) {
  switch (sev) {
    case 'Low': return 'bg-gray-100 text-gray-600';
    case 'Medium': return 'bg-amber-100 text-amber-700';
    case 'High': return 'bg-orange-100 text-orange-700';
    case 'Critical': return 'bg-red-100 text-red-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

type ViewMode = 'list' | 'edit';

export default function AssetsPage() {
  const [mode, setMode] = useState<ViewMode>('list');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [dashboard, setDashboard] = useState<AssetDashboard | null>(null);
  const [selected, setSelected] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [tab, setTab] = useState<'photos' | 'documents' | 'movements' | 'damage' | 'qr'>('photos');

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCondition, setFilterCondition] = useState('');

  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editSerial, setEditSerial] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState('');
  const [editPurchasePrice, setEditPurchasePrice] = useState('');
  const [editSupplier, setEditSupplier] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editCurrentLocation, setEditCurrentLocation] = useState('');
  const [editCondition, setEditCondition] = useState('Good');
  const [editStatus, setEditStatus] = useState('Available');
  const [editAssignedEmployee, setEditAssignedEmployee] = useState('');
  const [editWarrantyExpiry, setEditWarrantyExpiry] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [newMovementFrom, setNewMovementFrom] = useState('');
  const [newMovementTo, setNewMovementTo] = useState('');
  const [newMovementBy, setNewMovementBy] = useState('');
  const [newMovementNotes, setNewMovementNotes] = useState('');

  const [damageDesc, setDamageDesc] = useState('');
  const [damageSeverity, setDamageSeverity] = useState('Medium');
  const [damageStatus, setDamageStatus] = useState('Open');
  const [damageCost, setDamageCost] = useState('');
  const [damageNotes, setDamageNotes] = useState('');

  const [qrCodeData, setQrCodeData] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true); setError('');
    try {
      const [a, d] = await Promise.all([assetApi.list(), assetApi.dashboard()]);
      setAssets(a); setDashboard(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assets');
    } finally { setLoading(false); }
  };

  const openEdit = async (id?: string) => {
    setError(''); setMessage(''); setQrCodeData('');
    if (!id) {
      setSelected(null);
      setEditName(''); setEditCategory(''); setEditSerial('');
      setEditPurchaseDate(''); setEditPurchasePrice(''); setEditSupplier('');
      setEditBranch(''); setEditCurrentLocation('');
      setEditCondition('Good'); setEditStatus('Available');
      setEditAssignedEmployee(''); setEditWarrantyExpiry(''); setEditNotes('');
      setTab('photos'); setMode('edit'); return;
    }
    setLoading(true);
    try {
      const asset = await assetApi.get(id);
      setSelected(asset);
      setEditName(asset.name); setEditCategory(asset.category); setEditSerial(asset.serialNumber || '');
      setEditPurchaseDate(asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : '');
      setEditPurchasePrice(asset.purchasePrice != null ? String(asset.purchasePrice) : '');
      setEditSupplier(asset.supplier || '');
      setEditBranch(asset.branch?.name || '');
      setEditCurrentLocation(asset.currentLocation || '');
      setEditCondition(asset.condition); setEditStatus(asset.status);
      setEditAssignedEmployee(asset.assignedEmployee || '');
      setEditWarrantyExpiry(asset.warrantyExpiry ? asset.warrantyExpiry.slice(0, 10) : '');
      setEditNotes(asset.notes || '');
      setNewMovementFrom(''); setNewMovementTo(''); setNewMovementBy(''); setNewMovementNotes('');
      setDamageDesc(''); setDamageSeverity('Medium'); setDamageStatus('Open'); setDamageCost(''); setDamageNotes('');
      setTab('photos'); setMode('edit');
      try {
        const qr = await assetApi.getQrCode(id);
        setQrCodeData(qr.qrCode);
      } catch { /* QR may not exist */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load asset');
    } finally { setLoading(false); }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) { setError('Name is required'); return; }
    setSaving(true); setError(''); setMessage('');
    const payload: Record<string, unknown> = {
      name: editName.trim(), category: editCategory, serialNumber: editSerial || null,
      purchaseDate: editPurchaseDate || null, purchasePrice: editPurchasePrice ? Number(editPurchasePrice) : null,
      supplier: editSupplier || null, currentLocation: editCurrentLocation || null,
      condition: editCondition, status: editStatus, assignedEmployee: editAssignedEmployee || null,
      warrantyExpiry: editWarrantyExpiry || null, notes: editNotes || null,
    };
    try {
      if (selected) {
        const updated = await assetApi.update(selected.id, payload);
        setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        setSelected(updated); setMessage('Asset saved');
      } else {
        const created = await assetApi.create(payload);
        setAssets((prev) => [...prev, created]);
        setMessage('Asset created');
        setSelected(created);
        try {
          const qr = await assetApi.getQrCode(created.id);
          setQrCodeData(qr.qrCode);
        } catch { /* ok */ }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset? This action cannot be undone.')) return;
    try {
      await assetApi.delete(id);
      setAssets((prev) => prev.filter((a) => a.id !== id));
      if (selected?.id === id) { setMode('list'); setSelected(null); }
      setMessage('Asset deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!selected) return;
    try {
      const updated = await assetApi.uploadPhoto(selected.id, file);
      setSelected(updated);
      setAssets((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Photo upload failed');
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!selected || !confirm('Remove this photo?')) return;
    try {
      await assetApi.deletePhoto(selected.id, photoId);
      setSelected({ ...selected, photos: selected.photos.filter((p) => p.id !== photoId) });
      setAssets((prev) => prev.map((a) => (a.id === selected.id ? { ...a, photos: a.photos.filter((p) => p.id !== photoId) } : a)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleAddMovement = async () => {
    if (!selected) return;
    try {
      const m = await assetApi.addMovement(selected.id, {
        fromLocation: newMovementFrom || null, toLocation: newMovementTo || null,
        movedBy: newMovementBy || null, notes: newMovementNotes || null,
      });
      setSelected({ ...selected, movementHistories: [...selected.movementHistories, m] });
      setNewMovementFrom(''); setNewMovementTo(''); setNewMovementBy(''); setNewMovementNotes('');
      setMessage('Movement added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add movement');
    }
  };

  const handleAddDamageReport = async () => {
    if (!selected || !damageDesc.trim()) { setError('Description is required'); return; }
    try {
      const r = await assetApi.addDamageReport(selected.id, {
        description: damageDesc.trim(), severity: damageSeverity, status: damageStatus,
        cost: damageCost ? Number(damageCost) : null, notes: damageNotes || null,
      });
      setSelected({ ...selected, damageReports: [...selected.damageReports, r] });
      setDamageDesc(''); setDamageSeverity('Medium'); setDamageStatus('Open'); setDamageCost(''); setDamageNotes('');
      setMessage('Damage report added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add damage report');
    }
  };

  const handleUpdateDamageStatus = async (reportId: string, newStatus: string) => {
    if (!selected) return;
    try {
      const r = await assetApi.updateDamageReport(selected.id, reportId, { status: newStatus });
      setSelected({ ...selected, damageReports: selected.damageReports.map((d) => (d.id === r.id ? r : d)) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const filteredAssets = assets.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      if (!a.name.toLowerCase().includes(q) && !(a.serialNumber || '').toLowerCase().includes(q)) return false;
    }
    if (filterCategory && a.category !== filterCategory) return false;
    if (filterStatus && a.status !== filterStatus) return false;
    if (filterCondition && a.condition !== filterCondition) return false;
    return true;
  });

  if (loading && mode === 'list') return <div className="p-8 text-muted"><Loader2 size={20} className="inline animate-spin mr-2" />Loading assets...</div>;

  if (mode === 'edit') {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          <button onClick={() => { setMode('list'); setError(''); setMessage(''); }} className="mb-6 flex items-center gap-2 text-sm text-muted transition hover:text-ink">
            <ArrowLeft size={16} /> Back to Assets
          </button>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Inventory</p>
          <h1 className="mt-3 font-display text-4xl text-ink">{selected ? 'Edit Asset' : 'New Asset'}</h1>

          <form onSubmit={handleSave} className="mt-8">
            {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
            {message && <div className="mb-6 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><Check size={15} />{message}</div>}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-6">
                <section className="rounded-lg border border-parchment-dark bg-white p-6">
                  <h2 className="font-display text-xl text-ink">Basic Information</h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Name *</span>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Category</span>
                      <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]">
                        <option value="">Select category</option>
                        {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Serial Number</span>
                      <input value={editSerial} onChange={(e) => setEditSerial(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Purchase Date</span>
                      <input type="date" value={editPurchaseDate} onChange={(e) => setEditPurchaseDate(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Purchase Price</span>
                      <input type="number" step="0.01" min="0" value={editPurchasePrice} onChange={(e) => setEditPurchasePrice(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Supplier</span>
                      <input value={editSupplier} onChange={(e) => setEditSupplier(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                  </div>
                </section>

                <section className="rounded-lg border border-parchment-dark bg-white p-6">
                  <h2 className="font-display text-xl text-ink">Location & Status</h2>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Branch</span>
                      <input value={editBranch} onChange={(e) => setEditBranch(e.target.value)} placeholder="Branch name" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Current Location</span>
                      <input value={editCurrentLocation} onChange={(e) => setEditCurrentLocation(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Condition</span>
                      <select value={editCondition} onChange={(e) => setEditCondition(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]">
                        {CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Status</span>
                      <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]">
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Assigned Employee</span>
                      <input value={editAssignedEmployee} onChange={(e) => setEditAssignedEmployee(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Warranty Expiry</span>
                      <input type="date" value={editWarrantyExpiry} onChange={(e) => setEditWarrantyExpiry(e.target.value)} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold text-muted">Notes</span>
                      <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]" />
                    </label>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                {selected && (
                  <section className="rounded-lg border border-parchment-dark bg-white">
                    <div className="flex border-b border-parchment-dark">
                      {(['photos', 'documents', 'movements', 'damage', 'qr'] as const).map((t) => (
                        <button key={t} type="button" onClick={() => setTab(t)}
                          className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide transition ${
                            tab === t ? 'border-b-2 border-[var(--brand-accent)] text-[var(--brand-accent)]' : 'text-muted hover:text-ink'
                          }`}
                        >
                          {t === 'photos' && <Camera size={14} className="inline mr-1.5" />}
                          {t === 'documents' && <FileText size={14} className="inline mr-1.5" />}
                          {t === 'movements' && <MapPin size={14} className="inline mr-1.5" />}
                          {t === 'damage' && <AlertTriangle size={14} className="inline mr-1.5" />}
                          {t === 'qr' && <QrCode size={14} className="inline mr-1.5" />}
                          {t === 'photos' ? 'Photos' : t === 'documents' ? 'Documents' : t === 'movements' ? 'Movement' : t === 'damage' ? 'Damage' : 'QR Code'}
                        </button>
                      ))}
                    </div>

                    <div className="p-5">
                      {tab === 'photos' && (
                        <div>
                          {(selected.photos ?? []).length > 0 && (
                            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                              {(selected.photos ?? []).map((p) => (
                                <div key={p.id} className="group relative">
                                  <img src={photoUrl(p.url)} alt={p.caption || ''} className="h-28 w-full rounded-lg object-cover" />
                                  <button type="button" onClick={() => handleDeletePhoto(p.id)}
                                    className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition group-hover:opacity-100"
                                  ><Trash2 size={12} /></button>
                                </div>
                              ))}
                            </div>
                          )}
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-parchment-dark p-4 text-sm text-muted transition hover:border-[var(--brand-accent)]">
                            <Camera size={16} /> Upload Photo
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await handlePhotoUpload(f); } e.target.value = ''; }} />
                          </label>
                        </div>
                      )}

                      {tab === 'documents' && (
                        <div>
                          {(selected.documents ?? []).length > 0 && (
                            <div className="mb-4 space-y-2">
                              {(selected.documents ?? []).map((d) => (
                                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-parchment-dark bg-parchment/30 p-3 text-sm">
                                  <FileText size={16} className="text-muted shrink-0" />
                                  <span className="flex-1 truncate font-medium text-ink">{d.name}</span>
                                  <a href={photoUrl(d.url)} target="_blank" rel="noreferrer" className="text-[var(--brand-accent)] hover:underline shrink-0"><Download size={14} /></a>
                                </div>
                              ))}
                            </div>
                          )}
                          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-parchment-dark p-4 text-sm text-muted transition hover:border-[var(--brand-accent)]">
                            <Upload size={16} /> Upload Document
                            <input type="file" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await assetApi.uploadPhoto(selected.id, f).then((u) => { setSelected(u); setAssets((prev) => prev.map((a) => (a.id === u.id ? u : a))); }); } e.target.value = ''; }} />
                          </label>
                        </div>
                      )}

                      {tab === 'movements' && (
                        <div>
                          {(selected.movementHistories ?? []).length > 0 && (
                            <div className="mb-4 space-y-2">
                              {(selected.movementHistories ?? []).map((m) => (
                                <div key={m.id} className="rounded-lg border border-parchment-dark bg-parchment/30 p-3 text-sm">
                                  <div className="flex items-center gap-2 text-xs text-muted">
                                    <Calendar size={12} />{new Date(m.movedAt).toLocaleDateString()}
                                    {m.movedBy && <><User size={12} />{m.movedBy}</>}
                                  </div>
                                  <div className="mt-1 flex items-center gap-2 text-ink">
                                    <span className="font-medium">{m.fromLocation || m.fromBranch || 'Unknown'}</span>
                                    <span className="text-muted">&rarr;</span>
                                    <span className="font-medium">{m.toLocation || m.toBranch || 'Unknown'}</span>
                                  </div>
                                  {m.notes && <p className="mt-1 text-muted">{m.notes}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="grid gap-3 sm:grid-cols-2">
                            <input value={newMovementFrom} onChange={(e) => setNewMovementFrom(e.target.value)} placeholder="From location" className="rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]" />
                            <input value={newMovementTo} onChange={(e) => setNewMovementTo(e.target.value)} placeholder="To location" className="rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]" />
                            <input value={newMovementBy} onChange={(e) => setNewMovementBy(e.target.value)} placeholder="Moved by" className="rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]" />
                            <input value={newMovementNotes} onChange={(e) => setNewMovementNotes(e.target.value)} placeholder="Notes" className="rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]" />
                            <button type="button" onClick={handleAddMovement} className="brand-button col-span-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"><Plus size={14} />Add Movement</button>
                          </div>
                        </div>
                      )}

                      {tab === 'damage' && (
                        <div>
                          {(selected.damageReports ?? []).length > 0 && (
                            <div className="mb-4 space-y-2">
                              {(selected.damageReports ?? []).map((r) => (
                                <div key={r.id} className="rounded-lg border border-parchment-dark bg-parchment/30 p-3 text-sm">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityColor(r.severity)}`}>{r.severity}</span>
                                    <select value={r.status} onChange={(e) => handleUpdateDamageStatus(r.id, e.target.value)}
                                      className={`rounded-full border-0 px-2 py-0.5 text-xs font-semibold ${r.status === 'Open' ? 'bg-red-100 text-red-700' : r.status === 'In Progress' ? 'bg-blue-100 text-blue-700' : r.status === 'Resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}
                                    >
                                      {REPORT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    {r.cost != null && <span className="text-muted">R{r.cost.toFixed(2)}</span>}
                                  </div>
                                  <p className="mt-1 text-ink">{r.description}</p>
                                  <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                                    <Calendar size={12} />{new Date(r.date).toLocaleDateString()}
                                    {r.reportedBy && <><User size={12} />{r.reportedBy}</>}
                                  </div>
                                  {r.notes && <p className="mt-1 text-muted">{r.notes}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="space-y-3">
                            <textarea value={damageDesc} onChange={(e) => setDamageDesc(e.target.value)} placeholder="Description *" rows={2} className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]" />
                            <div className="grid gap-3 sm:grid-cols-3">
                              <select value={damageSeverity} onChange={(e) => setDamageSeverity(e.target.value)} className="rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]">
                                {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <select value={damageStatus} onChange={(e) => setDamageStatus(e.target.value)} className="rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]">
                                {REPORT_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <input type="number" step="0.01" min="0" value={damageCost} onChange={(e) => setDamageCost(e.target.value)} placeholder="Cost" className="rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]" />
                            </div>
                            <input value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} placeholder="Notes" className="w-full rounded-lg border border-parchment-dark bg-white px-3 py-2 text-sm outline-none focus:border-[var(--brand-accent)]" />
                            <button type="button" onClick={handleAddDamageReport} className="brand-button flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold"><Plus size={14} />Add Report</button>
                          </div>
                        </div>
                      )}

                      {tab === 'qr' && (
                        <div>
                          {qrCodeData ? (
                            <div className="flex flex-col items-center gap-4">
                              <img src={qrCodeData} alt="QR Code for asset" className="h-48 w-48 rounded-lg border border-parchment-dark" />
                              <div className="text-center text-sm text-muted">
                                <p>Scan this QR code to view asset details.</p>
                                <p className="mt-1">Print and attach to the asset for easy tracking.</p>
                              </div>
                              <a href={qrCodeData} download={`asset-${selected.id}-qr.png`}
                                className="brand-button inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold"
                              ><Download size={14} /> Download QR Code</a>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted">
                              <QrCode size={40} className="text-parchment-dark/40" />
                              <p>Save the asset first to generate a QR code.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {!selected && (
                  <section className="flex items-center justify-center rounded-lg border border-dashed border-parchment-dark p-12 text-sm text-muted">
                    Save the asset to access photos, documents, movement history, damage reports, and QR code.
                  </section>
                )}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <button type="submit" disabled={saving} className="brand-button flex items-center gap-2 px-5 py-3 text-sm font-semibold" style={saving ? { opacity: 0.6 } : {}}>
                {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : selected ? 'Save Asset' : 'Create Asset'}
              </button>
              <button type="button" onClick={() => { setMode('list'); setError(''); setMessage(''); }} className="rounded-lg border border-parchment-dark px-5 py-3 text-sm font-semibold text-muted transition hover:bg-parchment hover:text-ink">Cancel</button>
              {selected && (
                <button type="button" onClick={() => handleDelete(selected.id)} className="ml-auto flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"><Trash2 size={16} />Delete Asset</button>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="mb-6 flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><Check size={15} />{message}</div>}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Inventory</p>
            <h1 className="mt-3 font-display text-4xl text-ink">Asset Management</h1>
          </div>
          <button onClick={() => openEdit()} className="brand-button flex items-center gap-2 px-5 py-3 text-sm font-semibold">
            <Plus size={16} /> Add Asset
          </button>
        </div>

        {dashboard && (
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-lg border border-parchment-dark bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted"><Package size={14} />Total</div>
              <p className="mt-1 font-display text-3xl text-ink">{dashboard.total}</p>
            </div>
            {STATUS_OPTIONS.map((s) => (
              <div key={s} className="rounded-lg border border-parchment-dark bg-white p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted"><Tag size={14} />{s}</div>
                <p className="mt-1 font-display text-3xl text-ink">{dashboard.byStatus[s] || 0}</p>
              </div>
            ))}
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase text-amber-700"><AlertTriangle size={14} />Warranty Expiring</div>
              <p className="mt-1 font-display text-3xl text-amber-800">{dashboard.warrantyExpiringSoon}</p>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or serial..." className="w-full rounded-lg border border-parchment-dark bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand-accent)]" />
          </div>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]">
            <option value="">All Categories</option>
            {ASSET_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]">
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterCondition} onChange={(e) => setFilterCondition(e.target.value)} className="rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]">
            <option value="">All Conditions</option>
            {CONDITION_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {filteredAssets.length === 0 ? (
          <div className="mt-12 text-center">
            <Package size={48} className="mx-auto text-parchment-dark/40" />
            <p className="mt-4 text-lg font-semibold text-ink">No assets found</p>
            <p className="mt-1 text-sm text-muted">{assets.length === 0 ? 'Add your first asset to get started.' : 'Try adjusting your filters.'}</p>
            {assets.length === 0 && (
              <button onClick={() => openEdit()} className="brand-button mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold">
                <Plus size={16} /> Add Asset
              </button>
            )}
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredAssets.map((asset) => (
              <div key={asset.id} className="group rounded-lg border border-parchment-dark bg-white transition hover:border-[var(--brand-accent)]">
                <button onClick={() => openEdit(asset.id)} className="w-full p-5 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_COLORS[asset.category] || 'bg-gray-100 text-gray-700'}`}>
                      {asset.category || 'Uncategorised'}
                    </span>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColor(asset.status)}`}>
                      {asset.status}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-lg text-ink">{asset.name}</h3>
                  {asset.serialNumber && <p className="mt-0.5 text-xs text-muted">SN: {asset.serialNumber}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${conditionColor(asset.condition)}`}>
                      {asset.condition}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs text-muted">
                    {asset.branch && (
                      <span className="flex items-center gap-1.5"><Building2 size={12} />{asset.branch.name}</span>
                    )}
                    {asset.currentLocation && (
                      <span className="flex items-center gap-1.5"><MapPin size={12} />{asset.currentLocation}</span>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1 border-t border-parchment-dark/50 px-5 py-2">
                  <button onClick={() => openEdit(asset.id)} className="rounded-lg p-1.5 text-muted transition hover:bg-parchment hover:text-ink" title="Edit"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(asset.id)} className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50" title="Delete"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
