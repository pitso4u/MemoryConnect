import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, ClipboardList, Truck, Package, Plus, Check, X, Loader2, Calendar,
  Search, AlertTriangle, CheckCircle, XCircle, User, Clock, LogOut,
  RotateCcw, Ban,
} from 'lucide-react';
import { api, vehicleApi, assetApi, funeralResourceApi } from '../lib/api';
import type {
  Memorial, Vehicle, Asset, FuneralResourceReservation,
} from '../lib/api';

type Toast = { id: number; type: 'success' | 'error'; message: string };
let toastId = 0;

interface CheckedVehicle extends Vehicle { _checked: boolean; _availability?: boolean; _checking?: boolean }
interface CheckedAsset extends Asset { _checked: boolean; _quantity: number; _availability?: boolean; _checking?: boolean }

export default function FuneralResourcesPage() {
  const [memorials, setMemorials] = useState<Memorial[]>([]);
  const [memorialsLoading, setMemorialsLoading] = useState(true);
  const [selectedMemorial, setSelectedMemorial] = useState<Memorial | null>(null);
  const [memorialSearch, setMemorialSearch] = useState('');
  const [memorialDropdownOpen, setMemorialDropdownOpen] = useState(false);

  const [vehicles, setVehicles] = useState<CheckedVehicle[]>([]);
  const [assets, setAssets] = useState<CheckedAsset[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);

  const [reservations, setReservations] = useState<FuneralResourceReservation[]>([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);

  const [notes, setNotes] = useState('');
  const [reserving, setReserving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: 'success' | 'error', message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  useEffect(() => { loadMemorials(); }, []);

  const loadMemorials = async () => {
    try {
      setMemorialsLoading(true);
      const data = await api.getMemorials();
      setMemorials(data);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to load memorials');
    } finally {
      setMemorialsLoading(false);
    }
  };

  const loadResources = async (memorial: Memorial) => {
    setSelectedMemorial(memorial);
    setMemorialDropdownOpen(false);
    setNotes('');
    try {
      setResourcesLoading(true);
      const [vehicleData, assetData] = await Promise.all([
        vehicleApi.list('Available'),
        assetApi.list({ status: 'Available' }),
      ]);
      setVehicles(vehicleData.map((v) => ({ ...v, _checked: false, _quantity: 1 })));
      setAssets(assetData.map((a) => ({ ...a, _checked: false, _quantity: 1 })));
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to load resources');
    } finally {
      setResourcesLoading(false);
    }
    loadReservations(memorial.id);
  };

  const loadReservations = async (memorialId: string) => {
    try {
      setReservationsLoading(true);
      const data = await funeralResourceApi.getForMemorial(memorialId);
      setReservations(data);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to load reservations');
    } finally {
      setReservationsLoading(false);
    }
  };

  const checkAvailability = async (item: CheckedVehicle | CheckedAsset, date: string) => {
    const params: { vehicleId?: string; assetId?: string; date: string } = { date };
    if ('registrationNumber' in item) {
      params.vehicleId = item.id;
    } else {
      params.assetId = item.id;
    }
    try {
      const res = await funeralResourceApi.checkAvailability(params);
      return res.available;
    } catch {
      return false;
    }
  };

  const handleCheckAllAvailability = async () => {
    const date = selectedMemorial?.serviceDate || new Date().toISOString().split('T')[0];
    const updatedVehicles = [...vehicles];
    const updatedAssets = [...assets];

    for (let i = 0; i < updatedVehicles.length; i++) {
      if (updatedVehicles[i]._checked) {
        updatedVehicles[i] = { ...updatedVehicles[i], _checking: true };
        setVehicles(updatedVehicles);
        const available = await checkAvailability(updatedVehicles[i], date);
        updatedVehicles[i] = { ...updatedVehicles[i], _checking: false, _availability: available };
        setVehicles([...updatedVehicles]);
      }
    }

    for (let i = 0; i < updatedAssets.length; i++) {
      if (updatedAssets[i]._checked) {
        updatedAssets[i] = { ...updatedAssets[i], _checking: true };
        setAssets(updatedAssets);
        const available = await checkAvailability(updatedAssets[i], date);
        updatedAssets[i] = { ...updatedAssets[i], _checking: false, _availability: available };
        setAssets([...updatedAssets]);
      }
    }
  };

  const toggleVehicle = (id: string) => {
    setVehicles((prev) =>
      prev.map((v) => (v.id === id ? { ...v, _checked: !v._checked, _availability: undefined } : v))
    );
  };

  const toggleAsset = (id: string) => {
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, _checked: !a._checked, _availability: undefined } : a))
    );
  };

  const setAssetQuantity = (id: string, qty: number) => {
    setAssets((prev) => prev.map((a) => (a.id === id ? { ...a, _quantity: Math.max(1, qty) } : a)));
  };

  const handleReserve = async () => {
    if (!selectedMemorial) return;
    const selectedVehicles = vehicles.filter((v) => v._checked);
    const selectedAssets = assets.filter((a) => a._checked);
    if (selectedVehicles.length === 0 && selectedAssets.length === 0) {
      addToast('error', 'Please select at least one vehicle or asset');
      return;
    }
    setReserving(true);
    const results: { success: number; fail: number } = { success: 0, fail: 0 };
    for (const v of selectedVehicles) {
      try {
        await funeralResourceApi.create({
          memorialId: selectedMemorial.id,
          vehicleId: v.id,
          quantity: 1,
          notes: notes || undefined,
        });
        results.success++;
      } catch {
        results.fail++;
      }
    }
    for (const a of selectedAssets) {
      try {
        await funeralResourceApi.create({
          memorialId: selectedMemorial.id,
          assetId: a.id,
          quantity: a._quantity,
          notes: notes || undefined,
        });
        results.success++;
      } catch {
        results.fail++;
      }
    }
    setReserving(false);
    if (results.success > 0) {
      addToast('success', `Successfully reserved ${results.success} resource${results.success > 1 ? 's' : ''}`);
      setVehicles((prev) => prev.map((v) => ({ ...v, _checked: false, _availability: undefined })));
      setAssets((prev) => prev.map((a) => ({ ...a, _checked: false, _availability: undefined })));
      setNotes('');
    }
    if (results.fail > 0) {
      addToast('error', `Failed to reserve ${results.fail} resource${results.fail > 1 ? 's' : ''}`);
    }
    if (selectedMemorial) loadReservations(selectedMemorial.id);
  };

  const handleAction = async (reservationId: string, action: 'check-out' | 'return' | 'cancel') => {
    setActionLoading(`${reservationId}-${action}`);
    try {
      await funeralResourceApi.update(reservationId, { action });
      addToast('success', `Resource ${action === 'check-out' ? 'checked out' : action === 'return' ? 'returned' : 'cancelled'} successfully`);
      if (selectedMemorial) loadReservations(selectedMemorial.id);
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : `Failed to ${action} resource`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredMemorials = memorials.filter(
    (m) =>
      m.deceasedName.toLowerCase().includes(memorialSearch.toLowerCase()) ||
      m.slug.toLowerCase().includes(memorialSearch.toLowerCase())
  );

  const selectedCount = vehicles.filter((v) => v._checked).length + assets.filter((a) => a._checked).length;
  const vehicleCount = vehicles.filter((v) => v._checked).length;
  const assetCount = assets.filter((a) => a._checked).length;

  const groupedAssets = assets.reduce<Record<string, CheckedAsset[]>>((acc, a) => {
    const cat = a.category || 'Uncategorised';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  const availabilityCheckNeeded = vehicles.some((v) => v._checked) || assets.some((a) => a._checked);
  const allChecked = [...vehicles, ...assets].filter((i) => i._checked);
  const allAvailChecked = allChecked.every((i) => i._availability !== undefined);
  const anyUnavailable = allChecked.some((i) => i._availability === false);

  const statusColors: Record<string, string> = {
    RESERVED: 'bg-blue-100 text-blue-700',
    CHECKED_OUT: 'bg-amber-100 text-amber-700',
    RETURNED: 'bg-emerald-100 text-emerald-700',
    CANCELLED: 'bg-gray-100 text-gray-500',
  };

  const memorialStatusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-600',
    PAID_PENDING: 'bg-amber-100 text-amber-700',
    PUBLISHED: 'bg-emerald-100 text-emerald-700',
    LOCKED: 'bg-red-100 text-red-700',
    EXPIRED: 'bg-gray-100 text-gray-500',
    DELETED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">
              Funeral Planning
            </p>
            <h1 className="mt-3 font-display text-4xl text-ink">Resource Reservations</h1>
          </div>
        </div>

        {/* Memorial Selector */}
        <div className="mt-6 rounded-lg border border-parchment-dark bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="relative min-w-[280px] flex-1">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
                Select Memorial
              </label>
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search by name or slug..."
                  value={memorialSearch}
                  onChange={(e) => { setMemorialSearch(e.target.value); setMemorialDropdownOpen(true); }}
                  onFocus={() => setMemorialDropdownOpen(true)}
                  className="w-full rounded-lg border border-parchment-dark bg-white py-2.5 pl-10 pr-3 text-sm text-ink placeholder:text-muted focus:border-[var(--brand-primary)] focus:outline-none"
                />
                {memorialsLoading && (
                  <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted" />
                )}
                {memorialDropdownOpen && !memorialsLoading && (
                  <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-parchment-dark bg-white shadow-lg">
                    {filteredMemorials.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-muted">No memorials found</div>
                    ) : (
                      filteredMemorials.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => loadResources(m)}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-parchment ${
                            selectedMemorial?.id === m.id ? 'bg-parchment' : ''
                          }`}
                        >
                          <span className="font-medium text-ink">{m.deceasedName}</span>
                          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${memorialStatusColors[m.status] || 'bg-gray-100 text-gray-500'}`}>
                            {m.status}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {selectedMemorial && (
              <div className="flex flex-1 flex-wrap items-center gap-4 rounded-lg bg-parchment/50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">{selectedMemorial.deceasedName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${memorialStatusColors[selectedMemorial.status] || 'bg-gray-100 text-gray-500'}`}>
                      {selectedMemorial.status}
                    </span>
                    {selectedMemorial.serviceDate && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(selectedMemorial.serviceDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {selectedMemorial && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => setSelectedMemorial(null)}
                className="flex items-center gap-1.5 rounded-lg border border-parchment-dark px-3 py-2 text-xs font-semibold text-muted transition hover:bg-parchment hover:text-ink"
              >
                <ArrowLeft size={14} /> Change
              </button>
            </div>
          )}
        </div>

        {!selectedMemorial && (
          <div className="mt-12 text-center">
            <ClipboardList size={48} className="mx-auto text-parchment-dark/40" />
            <p className="mt-4 text-lg font-semibold text-ink">Select a memorial</p>
            <p className="mt-1 text-sm text-muted">
              Choose a memorial above to view and manage its resource reservations.
            </p>
          </div>
        )}

        {selectedMemorial && (
          <>
            {/* Resource Grid */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Available Vehicles */}
              <div className="rounded-lg border border-parchment-dark bg-white">
                <div className="flex items-center gap-2 border-b border-parchment-dark px-4 py-3">
                  <Truck size={18} className="text-[var(--brand-primary)]" />
                  <h2 className="text-sm font-semibold text-ink">Available Vehicles</h2>
                  {vehicles.filter((v) => v._checked).length > 0 && (
                    <span className="ml-auto rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-xs font-semibold text-white">
                      {vehicles.filter((v) => v._checked).length}
                    </span>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto p-4">
                  {resourcesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-muted" />
                    </div>
                  ) : vehicles.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted">No available vehicles</div>
                  ) : (
                    <div className="space-y-2">
                      {vehicles.map((vehicle) => (
                        <button
                          key={vehicle.id}
                          onClick={() => toggleVehicle(vehicle.id)}
                          className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                            vehicle._checked
                              ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                              : 'border-parchment-dark hover:bg-parchment/50'
                          }`}
                        >
                          <div
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition ${
                              vehicle._checked
                                ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                                : 'border-parchment-dark bg-white'
                            }`}
                          >
                            {vehicle._checked && <Check size={12} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ink">{vehicle.name}</p>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                              <span className="rounded bg-parchment px-1.5 py-0.5 font-mono text-xs">
                                {vehicle.registrationNumber}
                              </span>
                              <span>{vehicle.vehicleType}</span>
                              {vehicle.capacity && <span>Cap: {vehicle.capacity}</span>}
                            </div>
                          </div>
                          {vehicle._checking && (
                            <Loader2 size={14} className="mt-1 animate-spin text-muted" />
                          )}
                          {vehicle._availability !== undefined && !vehicle._checking && (
                            <div className="mt-1 flex items-center gap-1 text-xs font-medium">
                              {vehicle._availability ? (
                                <span className="flex items-center gap-0.5 text-emerald-600">
                                  <CheckCircle size={12} /> Available
                                </span>
                              ) : (
                                <span className="flex items-center gap-0.5 text-red-600">
                                  <XCircle size={12} /> Unavailable
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Available Assets */}
              <div className="rounded-lg border border-parchment-dark bg-white">
                <div className="flex items-center gap-2 border-b border-parchment-dark px-4 py-3">
                  <Package size={18} className="text-[var(--brand-primary)]" />
                  <h2 className="text-sm font-semibold text-ink">Available Assets</h2>
                  {assets.filter((a) => a._checked).length > 0 && (
                    <span className="ml-auto rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-xs font-semibold text-white">
                      {assets.filter((a) => a._checked).length}
                    </span>
                  )}
                </div>
                <div className="max-h-[400px] overflow-y-auto p-4">
                  {resourcesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={24} className="animate-spin text-muted" />
                    </div>
                  ) : assets.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted">No available assets</div>
                  ) : (
                    Object.entries(groupedAssets).map(([category, catAssets]) => (
                      <div key={category} className="mb-4 last:mb-0">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{category}</p>
                        <div className="space-y-2">
                          {catAssets.map((asset) => (
                            <div
                              key={asset.id}
                              className={`rounded-lg border p-3 transition ${
                                asset._checked
                                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5'
                                  : 'border-parchment-dark'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <button onClick={() => toggleAsset(asset.id)} className="mt-0.5 shrink-0">
                                  <div
                                    className={`flex h-5 w-5 items-center justify-center rounded border-2 transition ${
                                      asset._checked
                                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white'
                                        : 'border-parchment-dark bg-white'
                                    }`}
                                  >
                                    {asset._checked && <Check size={12} />}
                                  </div>
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-ink">{asset.name}</p>
                                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted">
                                    <span className="rounded bg-parchment px-1.5 py-0.5">{asset.category}</span>
                                    <span className="rounded bg-parchment px-1.5 py-0.5">{asset.condition}</span>
                                  </div>
                                  {asset._checked && (
                                    <div className="mt-2 flex items-center gap-2">
                                      <label className="text-xs text-muted">Qty:</label>
                                      <input
                                        type="number"
                                        min={1}
                                        value={asset._quantity}
                                        onChange={(e) => setAssetQuantity(asset.id, parseInt(e.target.value) || 1)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-16 rounded border border-parchment-dark px-2 py-1 text-xs text-ink focus:border-[var(--brand-primary)] focus:outline-none"
                                      />
                                    </div>
                                  )}
                                </div>
                                {asset._checking && (
                                  <Loader2 size={14} className="mt-1 animate-spin text-muted" />
                                )}
                                {asset._availability !== undefined && !asset._checking && (
                                  <div className="mt-1 flex items-center gap-1 text-xs font-medium">
                                    {asset._availability ? (
                                      <span className="flex items-center gap-0.5 text-emerald-600">
                                        <CheckCircle size={12} /> Available
                                      </span>
                                    ) : (
                                      <span className="flex items-center gap-0.5 text-red-600">
                                        <XCircle size={12} /> Unavailable
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="mt-6 rounded-lg border border-parchment-dark bg-white p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1">
                  {selectedCount > 0 ? (
                    <p className="text-sm text-ink">
                      <span className="font-semibold">{vehicleCount} Vehicle{vehicleCount !== 1 ? 's' : ''}</span>
                      {vehicleCount > 0 && assetCount > 0 && <span> and </span>}
                      <span className="font-semibold">{assetCount} Asset{assetCount !== 1 ? 's' : ''}</span>
                      <span className="text-muted"> selected</span>
                    </p>
                  ) : (
                    <p className="text-sm text-muted">Select resources to reserve</p>
                  )}
                  {selectedCount > 0 && availabilityCheckNeeded && (
                    <div className="mt-2">
                      {!allAvailChecked ? (
                        <button
                          onClick={handleCheckAllAvailability}
                          className="flex items-center gap-1.5 rounded-lg border border-parchment-dark px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-parchment hover:text-ink"
                        >
                          <AlertTriangle size={14} /> Check Availability
                        </button>
                      ) : anyUnavailable ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-red-600">
                          <XCircle size={14} /> Some resources are unavailable for the selected date
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <CheckCircle size={14} /> All selected resources are available
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                  <input
                    type="text"
                    placeholder="Reservation notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-w-[200px] flex-1 rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:border-[var(--brand-primary)] focus:outline-none sm:flex-initial"
                  />
                  <button
                    onClick={handleReserve}
                    disabled={selectedCount === 0 || reserving || (allAvailChecked && anyUnavailable)}
                    className="brand-button flex items-center gap-2 px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
                  >
                    {reserving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    Reserve Selected
                  </button>
                </div>
              </div>
            </div>

            {/* Current Reservations */}
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={18} className="text-[var(--brand-primary)]" />
                <h2 className="text-sm font-semibold text-ink">Current Reservations</h2>
                {reservations.filter((r) => r.status !== 'CANCELLED' && r.status !== 'RETURNED').length > 0 && (
                  <span className="rounded-full bg-[var(--brand-primary)] px-2 py-0.5 text-xs font-semibold text-white">
                    {reservations.filter((r) => r.status !== 'CANCELLED' && r.status !== 'RETURNED').length}
                  </span>
                )}
              </div>
              <div className="overflow-x-auto rounded-lg border border-parchment-dark bg-white">
                {reservationsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 size={24} className="animate-spin text-muted" />
                  </div>
                ) : reservations.length === 0 ? (
                  <div className="py-12 text-center">
                    <ClipboardList size={36} className="mx-auto text-parchment-dark/40" />
                    <p className="mt-3 text-sm font-semibold text-ink">No reservations yet</p>
                    <p className="mt-1 text-xs text-muted">
                      Select resources above and click "Reserve Selected" to create a reservation.
                    </p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-parchment-dark bg-parchment/50 text-left text-xs font-semibold uppercase text-muted">
                        <th className="px-4 py-3">Resource Type</th>
                        <th className="px-4 py-3">Name</th>
                        <th className="px-4 py-3">Qty</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Reserved At</th>
                        <th className="px-4 py-3">Reserved By</th>
                        <th className="px-4 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map((r) => (
                        <tr key={r.id} className="border-b border-parchment-dark/50 last:border-0">
                          <td className="px-4 py-3">
                            {r.vehicle ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                                <Truck size={12} /> Vehicle
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2.5 py-0.5 text-xs font-semibold text-cyan-700">
                                <Package size={12} /> Asset
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-ink">
                            {r.vehicle?.name || r.asset?.name || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted">{r.quantity}</td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusColors[r.status] || 'bg-gray-100 text-gray-500'}`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted">
                            <span className="flex items-center gap-1">
                              <Calendar size={12} />
                              {new Date(r.reservedAt).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {r.reservedBy ? (
                              <span className="flex items-center gap-1 text-muted">
                                <User size={12} /> {r.reservedBy}
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              {(r.status === 'RESERVED' || r.status === 'CHECKED_OUT') && (
                                <button
                                  onClick={() => handleAction(r.id, 'check-out')}
                                  disabled={actionLoading === `${r.id}-check-out` || r.status === 'CHECKED_OUT'}
                                  className="rounded-lg p-1.5 text-blue-600 transition hover:bg-blue-50 disabled:opacity-40"
                                  title="Check Out"
                                >
                                  {actionLoading === `${r.id}-check-out` ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <LogOut size={14} />
                                  )}
                                </button>
                              )}
                              {r.status === 'CHECKED_OUT' && (
                                <button
                                  onClick={() => handleAction(r.id, 'return')}
                                  disabled={actionLoading === `${r.id}-return`}
                                  className="rounded-lg p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-40"
                                  title="Return"
                                >
                                  {actionLoading === `${r.id}-return` ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <RotateCcw size={14} />
                                  )}
                                </button>
                              )}
                              {(r.status === 'RESERVED' || r.status === 'CHECKED_OUT') && (
                                <button
                                  onClick={() => handleAction(r.id, 'cancel')}
                                  disabled={actionLoading === `${r.id}-cancel`}
                                  className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 disabled:opacity-40"
                                  title="Cancel"
                                >
                                  {actionLoading === `${r.id}-cancel` ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Ban size={14} />
                                  )}
                                </button>
                              )}
                              {r.status === 'RETURNED' && (
                                <span className="text-xs text-muted italic">Complete</span>
                              )}
                              {r.status === 'CANCELLED' && (
                                <span className="text-xs text-muted italic">Cancelled</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Toast notifications */}
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${
                t.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
              }`}
            >
              {t.type === 'success' ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {t.message}
              <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="ml-2">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
