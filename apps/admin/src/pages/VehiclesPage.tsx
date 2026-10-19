import { FormEvent, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Camera, Check,
  Edit2, FileText, Fuel,
  Image, Loader2, Plus, Search, Shield, Trash2, Truck, Users, Wrench, X,
} from 'lucide-react';
import { vehicleApi, photoUrl, Vehicle, VehiclePhoto, ServiceHistory, FuelLog, MaintenanceLog, VehicleDashboard } from '../lib/api';

type ViewMode = 'list' | 'edit';
type EditorTab = 'photos' | 'service' | 'fuel' | 'maintenance' | 'documents';
type ToastType = 'success' | 'error';

const VEHICLE_TYPES = ['Sedan', 'SUV', 'Hatchback', 'Coupe', 'Convertible', 'Wagon', 'Van', 'Minibus', 'Bus', 'Truck', 'Trailer', 'Motorcycle', 'Other'];
const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'LPG', 'CNG', 'Other'];
const TRANSMISSIONS = ['Manual', 'Automatic', 'Semi-Automatic', 'CVT', 'DCT'];
const STATUS_OPTIONS = ['Available', 'Booked', 'InMaintenance', 'Inactive'];
const MAINTENANCE_STATUS = ['Scheduled', 'InProgress', 'Completed'];

const statusBadge = (status: string) => {
  const m: Record<string, string> = {
    Available: 'bg-emerald-100 text-emerald-700',
    Booked: 'bg-blue-100 text-blue-700',
    InMaintenance: 'bg-amber-100 text-amber-700',
    Inactive: 'bg-gray-100 text-gray-500',
  };
  return m[status] || 'bg-gray-100 text-gray-500';
};

const vehicleTypeBadge = (type: string) => {
  const colors: Record<string, string> = {
    Sedan: 'bg-indigo-100 text-indigo-700',
    SUV: 'bg-teal-100 text-teal-700',
    Truck: 'bg-orange-100 text-orange-700',
    Bus: 'bg-rose-100 text-rose-700',
    Motorcycle: 'bg-cyan-100 text-cyan-700',
    Van: 'bg-violet-100 text-violet-700',
  };
  return colors[type] || 'bg-gray-100 text-gray-700';
};

function fmtDate(val: string | null | undefined): string {
  if (!val) return '';
  try { return new Date(val).toISOString().slice(0, 10); } catch { return ''; }
}

function fmtDisplayDate(val: string | null | undefined): string {
  if (!val) return '-';
  try { return new Date(val).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return '-'; }
}

export default function VehiclesPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dashboard, setDashboard] = useState<VehicleDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: ToastType }>({ show: false, message: '', type: 'success' });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const showToast = (message: string, type: ToastType = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  };

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      setLoading(true); setError('');
      const [veh, dash] = await Promise.all([vehicleApi.list(), vehicleApi.dashboard()]);
      setVehicles(veh); setDashboard(dash);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vehicles');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;
    try {
      await vehicleApi.delete(id);
      setVehicles((prev) => prev.filter((v) => v.id !== id));
      showToast('Vehicle deleted');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'error');
    }
  };

  const filtered = vehicles.filter((v) => {
    if (search) {
      const q = search.toLowerCase();
      if (!v.name.toLowerCase().includes(q) && !v.registrationNumber.toLowerCase().includes(q)) return false;
    }
    if (typeFilter && v.vehicleType !== typeFilter) return false;
    if (statusFilter && v.status !== statusFilter) return false;
    return true;
  });

  if (loading) return <div className="p-8 text-muted"><Loader2 size={20} className="inline animate-spin mr-2" />Loading vehicles...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {toast.show && (
        <div className={`fixed right-6 top-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {toast.message}
        </div>
      )}

      {viewMode === 'edit' && selectedId ? (
        <VehicleEditor
          vehicleId={selectedId}
          onBack={() => { setViewMode('list'); setSelectedId(null); }}
          onSaved={(v) => {
            setVehicles((prev) => {
              const idx = prev.findIndex((x) => x.id === v.id);
              if (idx >= 0) { const c = [...prev]; c[idx] = v; return c; }
              return [v, ...prev];
            });
            showToast('Vehicle saved');
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      ) : viewMode === 'edit' && !selectedId ? (
        <VehicleEditor
          vehicleId={null}
          onBack={() => setViewMode('list')}
          onSaved={(v) => {
            setVehicles((prev) => [v, ...prev]);
            setSelectedId(v.id);
            showToast('Vehicle created');
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      ) : (
        <ListView
          vehicles={filtered}
          dashboard={dashboard}
          search={search}
          onSearchChange={setSearch}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onEdit={(id) => { setSelectedId(id); setViewMode('edit'); }}
          onAdd={() => { setSelectedId(null); setViewMode('edit'); }}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-parchment-dark bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ListView({
  vehicles, dashboard, search, onSearchChange, typeFilter, onTypeFilterChange,
  statusFilter, onStatusFilterChange, onEdit, onAdd, onDelete,
}: {
  vehicles: Vehicle[]; dashboard: VehicleDashboard | null;
  search: string; onSearchChange: (v: string) => void;
  typeFilter: string; onTypeFilterChange: (v: string) => void;
  statusFilter: string; onStatusFilterChange: (v: string) => void;
  onEdit: (id: string) => void; onAdd: () => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Fleet Management</p>
          <h1 className="mt-3 font-display text-4xl text-ink">Vehicles</h1>
        </div>
        <button onClick={onAdd} className="brand-button flex items-center gap-2 px-5 py-3 text-sm font-semibold">
          <Plus size={16} /> Add Vehicle
        </button>
      </div>

      {dashboard && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={dashboard.total} color="text-ink" />
          <StatCard label="Available" value={dashboard.available} color="text-emerald-600" />
          <StatCard label="Booked" value={dashboard.booked} color="text-blue-600" />
          <StatCard label="In Maintenance" value={dashboard.maintenance} color="text-amber-600" />
          <StatCard label="Inactive" value={dashboard.inactive} color="text-gray-500" />
          <StatCard label="License Expiring" value={dashboard.licenseExpiringSoon} color="text-red-600" />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name or reg..."
            className="w-full rounded-lg border border-parchment-dark bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[var(--brand-accent)]"
          />
        </div>
        <select value={typeFilter} onChange={(e) => onTypeFilterChange(e.target.value)} className="rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]">
          <option value="">All Types</option>
          {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => onStatusFilterChange(e.target.value)} className="rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {vehicles.length === 0 ? (
        <div className="mt-12 text-center">
          <Truck size={48} className="mx-auto text-parchment-dark/40" />
          <p className="mt-4 text-lg font-semibold text-ink">No vehicles found</p>
          <p className="mt-1 text-sm text-muted">Add your first vehicle to get started.</p>
          <button onClick={onAdd} className="brand-button mt-6 inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold">
            <Plus size={16} /> Add Vehicle
          </button>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="rounded-lg border border-parchment-dark bg-white transition hover:shadow-md">
              <div onClick={() => onEdit(vehicle.id)} className="cursor-pointer">
                {vehicle.photos && vehicle.photos.length > 0 ? (
                  <img src={photoUrl(vehicle.photos[0].url)} alt="" className="h-40 w-full rounded-t-lg object-cover" />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-t-lg bg-parchment">
                    <Truck size={40} className="text-parchment-dark/30" />
                  </div>
                )}
              </div>
              <div className="p-4" onClick={() => onEdit(vehicle.id)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-ink truncate">{vehicle.name}</h3>
                    <p className="text-xs text-muted">{vehicle.registrationNumber}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${vehicleTypeBadge(vehicle.vehicleType)}`}>
                      {vehicle.vehicleType}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusBadge(vehicle.status)}`}>
                      {vehicle.status === 'InMaintenance' ? 'In Maintenance' : vehicle.status === 'Inactive' ? 'Inactive' : vehicle.status}
                    </span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted">
                  {vehicle.manufacturer && <span>{vehicle.manufacturer} {vehicle.model || ''}</span>}
                  {vehicle.year && <span className="text-right">{vehicle.year}</span>}
                  {vehicle.assignedDriver && (
                    <span className="col-span-2 flex items-center gap-1"><Users size={12} /> {vehicle.assignedDriver}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-end gap-1 border-t border-parchment-dark/50 px-4 py-2">
                <button onClick={() => onEdit(vehicle.id)} className="rounded-lg p-1.5 text-muted transition hover:bg-parchment hover:text-ink" title="Edit">
                  <Edit2 size={15} />
                </button>
                <button onClick={() => onDelete(vehicle.id)} className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50" title="Delete">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VehicleEditor({
  vehicleId, onBack, onSaved, onError,
}: {
  vehicleId: string | null; onBack: () => void; onSaved: (v: Vehicle) => void; onError: (msg: string) => void;
}) {
  const isNew = !vehicleId;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<EditorTab>('photos');

  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('Sedan');
  const [status, setStatus] = useState('Available');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [vin, setVin] = useState('');
  const [colour, setColour] = useState('');
  const [capacity, setCapacity] = useState('');
  const [currentMileage, setCurrentMileage] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [transmission, setTransmission] = useState('');
  const [insuranceCompany, setInsuranceCompany] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');
  const [roadworthyExpiry, setRoadworthyExpiry] = useState('');
  const [licenseDiskExpiry, setLicenseDiskExpiry] = useState('');
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [assignedDriver, setAssignedDriver] = useState('');
  const [notes, setNotes] = useState('');

  const [photos, setPhotos] = useState<VehiclePhoto[]>([]);
  const [serviceHistories, setServiceHistories] = useState<ServiceHistory[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);

  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (!vehicleId) return;
    (async () => {
      try {
        setLoading(true);
        const v = await vehicleApi.get(vehicleId);
        setName(v.name);
        setRegistrationNumber(v.registrationNumber);
        setVehicleType(v.vehicleType);
        setStatus(v.status);
        setManufacturer(v.manufacturer || '');
        setModel(v.model || '');
        setYear(v.year ? String(v.year) : '');
        setVin(v.vin || '');
        setColour(v.colour || '');
        setCapacity(v.capacity ? String(v.capacity) : '');
        setCurrentMileage(v.currentMileage ? String(v.currentMileage) : '');
        setFuelType(v.fuelType || '');
        setTransmission(v.transmission || '');
        setInsuranceCompany(v.insuranceCompany || '');
        setInsuranceNumber(v.insuranceNumber || '');
        setInsuranceExpiry(fmtDate(v.insuranceExpiry));
        setRoadworthyExpiry(fmtDate(v.roadworthyExpiry));
        setLicenseDiskExpiry(fmtDate(v.licenseDiskExpiry));
        setNextServiceDate(fmtDate(v.nextServiceDate));
        setAssignedDriver(v.assignedDriver || '');
        setNotes(v.notes || '');
        setPhotos(v.photos || []);
        setServiceHistories(v.serviceHistories || []);
        setFuelLogs(v.fuelLogs || []);
        setMaintenanceLogs(v.maintenanceLogs || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load vehicle');
      } finally { setLoading(false); }
    })();
  }, [vehicleId]);

  const buildPayload = () => ({
    name: name.trim(),
    registrationNumber: registrationNumber.trim(),
    vehicleType,
    status,
    manufacturer: manufacturer || null,
    model: model || null,
    year: year ? parseInt(year, 10) : null,
    vin: vin || null,
    colour: colour || null,
    capacity: capacity ? parseFloat(capacity) : null,
    currentMileage: currentMileage ? parseFloat(currentMileage) : null,
    fuelType: fuelType || null,
    transmission: transmission || null,
    insuranceCompany: insuranceCompany || null,
    insuranceNumber: insuranceNumber || null,
    insuranceExpiry: insuranceExpiry || null,
    roadworthyExpiry: roadworthyExpiry || null,
    licenseDiskExpiry: licenseDiskExpiry || null,
    nextServiceDate: nextServiceDate || null,
    assignedDriver: assignedDriver || null,
    notes: notes || null,
  });

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    if (!registrationNumber.trim()) { setError('Registration number is required'); return; }
    setSaving(true); setError('');
    try {
      if (isNew) {
        const created = await vehicleApi.create(buildPayload() as Record<string, unknown>);
        onSaved(created);
      } else {
        const updated = await vehicleApi.update(vehicleId, buildPayload() as Record<string, unknown>);
        onSaved(updated);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      setError(msg); onError(msg);
    } finally { setSaving(false); }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!vehicleId) { onError('Save the vehicle first before uploading photos'); return; }
    setUploadingPhoto(true);
    try {
      const updated = await vehicleApi.uploadPhoto(vehicleId, file);
      setPhotos(updated.photos || []);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Upload failed');
    } finally { setUploadingPhoto(false); }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!vehicleId) return;
    if (!confirm('Remove this photo?')) return;
    try {
      await vehicleApi.deletePhoto(vehicleId, photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleAddService = async () => {
    if (!vehicleId) return;
    const date = prompt('Service date (YYYY-MM-DD):');
    if (!date) return;
    try {
      const entry = await vehicleApi.addServiceHistory(vehicleId, { serviceDate: date });
      setServiceHistories((prev) => [...prev, entry]);
    } catch (err) { onError(err instanceof Error ? err.message : 'Failed to add service'); }
  };

  const handleDeleteService = async (id: string) => {
    if (!vehicleId) return;
    if (!confirm('Delete this service record?')) return;
    try {
      await vehicleApi.deleteServiceHistory(vehicleId, id);
      setServiceHistories((prev) => prev.filter((s) => s.id !== id));
    } catch (err) { onError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const handleAddFuel = async () => {
    if (!vehicleId) return;
    const date = prompt('Fuel date (YYYY-MM-DD):');
    if (!date) return;
    const amountStr = prompt('Amount (liters):');
    if (!amountStr) return;
    const costStr = prompt('Cost:');
    if (!costStr) return;
    try {
      const entry = await vehicleApi.addFuelLog(vehicleId, {
        date, amount: parseFloat(amountStr), cost: parseFloat(costStr),
      });
      setFuelLogs((prev) => [...prev, entry]);
    } catch (err) { onError(err instanceof Error ? err.message : 'Failed to add fuel log'); }
  };

  const handleDeleteFuel = async (id: string) => {
    if (!vehicleId) return;
    if (!confirm('Delete this fuel log entry?')) return;
    try {
      await vehicleApi.deleteFuelLog(vehicleId, id);
      setFuelLogs((prev) => prev.filter((f) => f.id !== id));
    } catch (err) { onError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const handleAddMaintenance = async () => {
    if (!vehicleId) return;
    const type = prompt('Maintenance type (e.g. Oil Change, Brakes):');
    if (!type) return;
    const date = prompt('Date (YYYY-MM-DD):');
    if (!date) return;
    try {
      const entry = await vehicleApi.addMaintenanceLog(vehicleId, { type, date, status: 'Scheduled' });
      setMaintenanceLogs((prev) => [...prev, entry]);
    } catch (err) { onError(err instanceof Error ? err.message : 'Failed to add maintenance'); }
  };

  const handleUpdateMaintenanceStatus = async (logId: string, newStatus: string) => {
    if (!vehicleId) return;
    try {
      const updated = await vehicleApi.updateMaintenanceLog(vehicleId, logId, { status: newStatus });
      setMaintenanceLogs((prev) => prev.map((m) => (m.id === logId ? updated : m)));
    } catch (err) { onError(err instanceof Error ? err.message : 'Update failed'); }
  };

  const handleDeleteMaintenance = async (logId: string) => {
    if (!vehicleId) return;
    if (!confirm('Delete this maintenance record?')) return;
    try {
      await vehicleApi.deleteMaintenanceLog(vehicleId, logId);
      setMaintenanceLogs((prev) => prev.filter((m) => m.id !== logId));
    } catch (err) { onError(err instanceof Error ? err.message : 'Delete failed'); }
  };

  const inputClass = 'w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand-accent)]';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-muted';

  if (loading) return <div className="p-8 text-muted"><Loader2 size={20} className="inline animate-spin mr-2" />Loading vehicle...</div>;

  return (
    <div className="mx-auto max-w-7xl">
      <button onClick={onBack} className="mb-6 flex items-center gap-2 text-sm text-muted transition hover:text-ink">
        <ArrowLeft size={16} /> Back to Vehicles
      </button>
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Fleet Management</p>
      <h1 className="mt-3 font-display text-4xl text-ink">{isNew ? 'Add Vehicle' : 'Edit Vehicle'}</h1>

      {error && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <form onSubmit={handleSave}>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <section className="rounded-lg border border-parchment-dark bg-white p-6">
              <h2 className="font-display text-xl text-ink">Basic Information</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Name *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
                </label>
                <label className="block sm:col-span-2">
                  <span className={labelClass}>Registration Number *</span>
                  <input value={registrationNumber} onChange={(e) => setRegistrationNumber(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Vehicle Type</span>
                  <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputClass}>
                    {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Status</span>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'InMaintenance' ? 'In Maintenance' : s}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-parchment-dark bg-white p-6">
              <h2 className="font-display text-xl text-ink">Specifications</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Manufacturer</span>
                  <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Model</span>
                  <input value={model} onChange={(e) => setModel(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Year</span>
                  <input type="number" value={year} onChange={(e) => setYear(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>VIN</span>
                  <input value={vin} onChange={(e) => setVin(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Colour</span>
                  <input value={colour} onChange={(e) => setColour(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Capacity</span>
                  <input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Current Mileage</span>
                  <input type="number" value={currentMileage} onChange={(e) => setCurrentMileage(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Fuel Type</span>
                  <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className={inputClass}>
                    <option value="">Select</option>
                    {FUEL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Transmission</span>
                  <select value={transmission} onChange={(e) => setTransmission(e.target.value)} className={inputClass}>
                    <option value="">Select</option>
                    {TRANSMISSIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-parchment-dark bg-white p-6">
              <h2 className="font-display text-xl text-ink">Insurance</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Insurance Company</span>
                  <input value={insuranceCompany} onChange={(e) => setInsuranceCompany(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Policy Number</span>
                  <input value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Insurance Expiry</span>
                  <input type="date" value={insuranceExpiry} onChange={(e) => setInsuranceExpiry(e.target.value)} className={inputClass} />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-parchment-dark bg-white p-6">
              <h2 className="font-display text-xl text-ink">Compliance</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Roadworthy Expiry</span>
                  <input type="date" value={roadworthyExpiry} onChange={(e) => setRoadworthyExpiry(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>License Disk Expiry</span>
                  <input type="date" value={licenseDiskExpiry} onChange={(e) => setLicenseDiskExpiry(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Next Service Date</span>
                  <input type="date" value={nextServiceDate} onChange={(e) => setNextServiceDate(e.target.value)} className={inputClass} />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-parchment-dark bg-white p-6">
              <h2 className="font-display text-xl text-ink">Assignment</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Assigned Driver</span>
                  <input value={assignedDriver} onChange={(e) => setAssignedDriver(e.target.value)} className={inputClass} />
                </label>
              </div>
            </section>

            <section className="rounded-lg border border-parchment-dark bg-white p-6">
              <h2 className="font-display text-xl text-ink">Notes</h2>
              <div className="mt-5">
                <label className="block">
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} className={inputClass} />
                </label>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-lg border border-parchment-dark bg-white">
              <div className="flex border-b border-parchment-dark">
                {([
                  { key: 'photos' as EditorTab, icon: Image, label: 'Photos' },
                  { key: 'service' as EditorTab, icon: Wrench, label: 'Service' },
                  { key: 'fuel' as EditorTab, icon: Fuel, label: 'Fuel' },
                  { key: 'maintenance' as EditorTab, icon: Shield, label: 'Maintenance' },
                  { key: 'documents' as EditorTab, icon: FileText, label: 'Documents' },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold transition ${
                      activeTab === tab.key
                        ? 'border-b-2 border-[var(--brand-accent)] text-[var(--brand-accent)]'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <tab.icon size={14} /> {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-4">
                {activeTab === 'photos' && (
                  <div>
                    {photos.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {photos.map((photo) => (
                          <div key={photo.id} className="group relative">
                            <img src={photoUrl(photo.url)} alt="" className="h-24 w-full rounded-lg object-cover" />
                            <button
                              type="button"
                              onClick={() => handleDeletePhoto(photo.id)}
                              className="absolute right-1 top-1 rounded-full bg-red-500 p-1 text-white opacity-0 transition group-hover:opacity-100"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <label className={`mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-parchment-dark p-4 text-sm text-muted transition hover:border-[var(--brand-accent)] ${!isNew ? '' : 'opacity-50'}`}>
                      <Camera size={16} />
                      <span>{uploadingPhoto ? 'Uploading...' : 'Upload Photo'}</span>
                      <input
                        type="file" accept="image/*" className="hidden" disabled={isNew}
                        onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await handlePhotoUpload(f); } e.target.value = ''; }}
                      />
                    </label>
                    {isNew && <p className="mt-2 text-xs text-muted">Save the vehicle first to upload photos.</p>}
                  </div>
                )}

                {activeTab === 'service' && (
                  <div>
                    {serviceHistories.length === 0 ? (
                      <p className="text-sm text-muted">No service history recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {serviceHistories.map((s) => (
                          <div key={s.id} className="flex items-center justify-between rounded-lg border border-parchment-dark/50 p-3 text-sm">
                            <div>
                              <span className="font-medium text-ink">{fmtDisplayDate(s.serviceDate)}</span>
                              {s.description && <span className="ml-2 text-muted">- {s.description}</span>}
                              {s.mileageAtService && <span className="ml-2 text-muted">| {s.mileageAtService} km</span>}
                              {s.cost && <span className="ml-2 text-muted">| R{s.cost.toFixed(2)}</span>}
                            </div>
                            <button type="button" onClick={() => handleDeleteService(s.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={handleAddService} disabled={isNew} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-accent)] transition hover:underline">
                      <Plus size={14} /> Add Service Record
                    </button>
                  </div>
                )}

                {activeTab === 'fuel' && (
                  <div>
                    {fuelLogs.length === 0 ? (
                      <p className="text-sm text-muted">No fuel logs recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {fuelLogs.map((f) => (
                          <div key={f.id} className="flex items-center justify-between rounded-lg border border-parchment-dark/50 p-3 text-sm">
                            <div>
                              <span className="font-medium text-ink">{fmtDisplayDate(f.date)}</span>
                              <span className="ml-2 text-muted">- {f.amount}L</span>
                              <span className="ml-2 text-muted">| R{f.cost.toFixed(2)}</span>
                              {f.mileage && <span className="ml-2 text-muted">| {f.mileage} km</span>}
                              {f.fuelType && <span className="ml-2 text-muted">| {f.fuelType}</span>}
                            </div>
                            <button type="button" onClick={() => handleDeleteFuel(f.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={handleAddFuel} disabled={isNew} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-accent)] transition hover:underline">
                      <Plus size={14} /> Add Fuel Log
                    </button>
                  </div>
                )}

                {activeTab === 'maintenance' && (
                  <div>
                    {maintenanceLogs.length === 0 ? (
                      <p className="text-sm text-muted">No maintenance logs recorded.</p>
                    ) : (
                      <div className="space-y-2">
                        {maintenanceLogs.map((m) => (
                          <div key={m.id} className="rounded-lg border border-parchment-dark/50 p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="font-medium text-ink">{m.type}</span>
                                <span className="ml-2 text-muted">- {fmtDisplayDate(m.date)}</span>
                                {m.cost && <span className="ml-2 text-muted">| R{m.cost.toFixed(2)}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={m.status}
                                  onChange={(e) => handleUpdateMaintenanceStatus(m.id, e.target.value)}
                                  className="rounded border border-parchment-dark px-2 py-0.5 text-xs outline-none"
                                >
                                  {MAINTENANCE_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <button type="button" onClick={() => handleDeleteMaintenance(m.id)} className="text-red-500 hover:text-red-700">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                            {m.description && <p className="mt-1 text-muted">{m.description}</p>}
                            {m.provider && <p className="text-muted">{m.provider}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    <button type="button" onClick={handleAddMaintenance} disabled={isNew} className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-accent)] transition hover:underline">
                      <Plus size={14} /> Add Maintenance Log
                    </button>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div>
                    <p className="text-sm text-muted">Document management coming soon.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={saving}
            className="brand-button flex items-center gap-2 px-5 py-3 text-sm font-semibold"
            style={saving ? { opacity: 0.6 } : {}}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {saving ? 'Saving...' : isNew ? 'Create Vehicle' : 'Save Vehicle'}
          </button>
          <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-lg border border-parchment-dark bg-white px-5 py-3 text-sm font-semibold text-muted transition hover:text-ink">
            <X size={16} /> Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
