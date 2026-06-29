import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Crosshair,
  ExternalLink,
  MapPin,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import {
  api,
  MemorialLocation,
  CreateMemorialLocationInput,
} from '../../lib/api';
import type { MemorialLocationType } from '@memorialconnect/shared';

const LOCATION_TYPES: Array<{ value: MemorialLocationType; label: string }> = [
  { value: 'HOME', label: 'Family Home' },
  { value: 'CHURCH', label: 'Church' },
  { value: 'CEMETERY', label: 'Cemetery' },
  { value: 'RECEPTION', label: 'Reception / After-tears' },
  { value: 'OTHER', label: 'Other' },
];

interface LocationDraft {
  type: MemorialLocationType;
  name: string;
  addressText: string;
  latitude: string;
  longitude: string;
  notes: string;
}

const emptyDraft: LocationDraft = {
  type: 'HOME',
  name: '',
  addressText: '',
  latitude: '',
  longitude: '',
  notes: '',
};

function toDraft(location: MemorialLocation): LocationDraft {
  return {
    type: location.type,
    name: location.name,
    addressText: location.addressText || '',
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    notes: location.notes || '',
  };
}

function parseLocation(draft: LocationDraft): CreateMemorialLocationInput {
  if (!draft.name.trim()) throw new Error('Location name is required');
  if (!draft.latitude.trim()) throw new Error('Latitude is required');
  if (!draft.longitude.trim()) throw new Error('Longitude is required');

  const latitude = Number(draft.latitude);
  const longitude = Number(draft.longitude);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }

  return {
    type: draft.type,
    name: draft.name.trim(),
    addressText: draft.addressText.trim() || null,
    latitude,
    longitude,
    notes: draft.notes.trim() || null,
  };
}

function mapsUrl(latitude: string, longitude: string): string | undefined {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!latitude.trim() || !longitude.trim() || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

interface LocationFieldsProps {
  draft: LocationDraft;
  onChange: (draft: LocationDraft) => void;
  onUseCurrentLocation: () => void;
  locating: boolean;
}

function LocationFields({ draft, onChange, onUseCurrentLocation, locating }: LocationFieldsProps) {
  const directionsUrl = mapsUrl(draft.latitude, draft.longitude);

  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-ink">
          Location type
          <select
            value={draft.type}
            onChange={(event) => onChange({ ...draft, type: event.target.value as MemorialLocationType })}
            className="mt-1.5 w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 font-normal focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          >
            {LOCATION_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-ink">
          Location name
          <input
            value={draft.name}
            onChange={(event) => onChange({ ...draft, name: event.target.value })}
            placeholder="e.g. Family Home"
            className="mt-1.5 w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 font-normal focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
          />
        </label>
      </div>

      <label className="text-sm font-medium text-ink">
        Address or landmark <span className="font-normal text-muted">(optional)</span>
        <input
          value={draft.addressText}
          onChange={(event) => onChange({ ...draft, addressText: event.target.value })}
          placeholder="For people reading the page — the pin remains the source of truth"
          className="mt-1.5 w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 font-normal focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
        />
      </label>

      <div className="rounded-xl border border-gold/25 bg-gold/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-ink"><MapPin size={16} className="text-gold-dark" /> Exact GPS pin</p>
            <p className="mt-1 text-xs text-muted">Coordinates guide guests; the address above is only descriptive.</p>
          </div>
          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={locating}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-parchment transition hover:bg-ink-light disabled:opacity-50"
          >
            <Crosshair size={16} />
            {locating ? 'Finding your pin…' : 'Use my current location'}
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-medium uppercase tracking-wide text-muted">
            Latitude
            <input
              type="number"
              inputMode="decimal"
              min="-90"
              max="90"
              step="any"
              required
              value={draft.latitude}
              onChange={(event) => onChange({ ...draft, latitude: event.target.value })}
              placeholder="-26.204103"
              className="mt-1.5 w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 font-mono text-sm normal-case tracking-normal text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
            />
          </label>
          <label className="text-xs font-medium uppercase tracking-wide text-muted">
            Longitude
            <input
              type="number"
              inputMode="decimal"
              min="-180"
              max="180"
              step="any"
              required
              value={draft.longitude}
              onChange={(event) => onChange({ ...draft, longitude: event.target.value })}
              placeholder="28.047305"
              className="mt-1.5 w-full rounded-lg border border-parchment-dark bg-white px-3 py-2.5 font-mono text-sm normal-case tracking-normal text-ink focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
            />
          </label>
        </div>
        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gold-dark hover:text-gold"
          >
            <ExternalLink size={14} /> Open this pin in Google Maps
          </a>
        )}
      </div>

      <label className="text-sm font-medium text-ink">
        Notes or arrival instructions <span className="font-normal text-muted">(optional)</span>
        <textarea
          value={draft.notes}
          onChange={(event) => onChange({ ...draft, notes: event.target.value })}
          placeholder="e.g. Enter through the blue gate and follow the signs"
          rows={3}
          className="mt-1.5 w-full resize-y rounded-lg border border-parchment-dark bg-white px-3 py-2.5 font-normal focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/20"
        />
      </label>
    </div>
  );
}

interface LocationManagerProps {
  memorialId: string;
  locations: MemorialLocation[];
  onChange: (locations: MemorialLocation[]) => void;
}

export function LocationManager({ memorialId, locations, onChange }: LocationManagerProps) {
  const [drafts, setDrafts] = useState<Record<string, LocationDraft>>({});
  const [newDraft, setNewDraft] = useState<LocationDraft>(emptyDraft);
  const [showAdd, setShowAdd] = useState(locations.length === 0);
  const [working, setWorking] = useState<string | null>(null);
  const [locating, setLocating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDrafts(Object.fromEntries(locations.map((location) => [location.id, toDraft(location)])));
  }, [locations]);

  const updateDraft = (id: string, draft: LocationDraft) => {
    setDrafts((current) => ({ ...current, [id]: draft }));
  };

  const captureCurrentLocation = (key: string, apply: (latitude: string, longitude: string) => void) => {
    setError('');
    setMessage('');
    if (!navigator.geolocation) {
      setError('This browser does not support location capture. Enter the coordinates manually instead.');
      return;
    }
    if (!window.isSecureContext) {
      setError('Current location requires HTTPS. Open the admin portal on its secure production URL, or enter the coordinates manually.');
      return;
    }

    setLocating(key);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        apply(position.coords.latitude.toFixed(7), position.coords.longitude.toFixed(7));
        setMessage(`Exact pin captured with approximately ${Math.round(position.coords.accuracy)} m accuracy.`);
        setLocating(null);
      },
      (locationError) => {
        const messages: Record<number, string> = {
          1: 'Location permission was denied. Allow location access in your browser, or enter the coordinates manually.',
          2: 'Your location could not be determined. Move to an open area and try again.',
          3: 'Location capture timed out. Please try again.',
        };
        setError(messages[locationError.code] || 'Location capture failed. Please enter the coordinates manually.');
        setLocating(null);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const addLocation = async () => {
    setError('');
    setMessage('');
    try {
      const data = parseLocation(newDraft);
      setWorking('new');
      const created = await api.createLocation(memorialId, data);
      onChange([...locations, created].sort((a, b) => a.orderIndex - b.orderIndex));
      setNewDraft(emptyDraft);
      setShowAdd(false);
      setMessage('Location pin added.');
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Failed to add location');
    } finally {
      setWorking(null);
    }
  };

  const saveLocation = async (location: MemorialLocation) => {
    const draft = drafts[location.id];
    if (!draft) return;
    setError('');
    setMessage('');
    try {
      const data = parseLocation(draft);
      setWorking(location.id);
      const updated = await api.updateLocation(memorialId, location.id, {
        ...data,
        orderIndex: location.orderIndex,
      });
      onChange(locations.map((item) => item.id === location.id ? updated : item));
      setMessage(`${updated.name} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save location');
    } finally {
      setWorking(null);
    }
  };

  const deleteLocation = async (location: MemorialLocation) => {
    if (!window.confirm(`Delete ${location.name}? Guests will no longer see this pin.`)) return;
    setError('');
    setMessage('');
    try {
      setWorking(location.id);
      await api.deleteLocation(memorialId, location.id);
      onChange(locations.filter((item) => item.id !== location.id));
      setMessage('Location deleted.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete location');
    } finally {
      setWorking(null);
    }
  };

  const moveLocation = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= locations.length) return;
    const reordered = [...locations];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    const normalized = reordered.map((location, orderIndex) => ({ ...location, orderIndex }));
    onChange(normalized);
    setError('');
    setMessage('');
    try {
      setWorking('reorder');
      await Promise.all([
        api.updateLocation(memorialId, normalized[index].id, { orderIndex: normalized[index].orderIndex }),
        api.updateLocation(memorialId, normalized[targetIndex].id, { orderIndex: normalized[targetIndex].orderIndex }),
      ]);
      setMessage('Location order updated.');
    } catch (moveError) {
      onChange(locations);
      setError(moveError instanceof Error ? moveError.message : 'Failed to reorder locations');
    } finally {
      setWorking(null);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-ink">Locations &amp; Directions</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">Save the exact GPS pin for every venue. Guests navigate to these coordinates, even when a place has no searchable address.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd((visible) => !visible)}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-parchment transition hover:bg-ink-light"
        >
          <Plus size={16} /> {showAdd ? 'Close form' : 'Add location'}
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {showAdd && (
        <div className="rounded-2xl border border-gold/35 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold/10 text-gold-dark"><Plus size={18} /></span>
            <div>
              <h3 className="font-display text-xl font-semibold text-ink">Add a precise location</h3>
              <p className="text-xs text-muted">Stand at the venue and capture the pin for best accuracy.</p>
            </div>
          </div>
          <LocationFields
            draft={newDraft}
            onChange={setNewDraft}
            locating={locating === 'new'}
            onUseCurrentLocation={() => captureCurrentLocation('new', (latitude, longitude) => setNewDraft((current) => ({ ...current, latitude, longitude })))}
          />
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={addLocation}
              disabled={working === 'new'}
              className="inline-flex items-center gap-2 rounded-lg bg-gold px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-gold-light disabled:opacity-50"
            >
              <Save size={16} /> {working === 'new' ? 'Saving…' : 'Save location'}
            </button>
          </div>
        </div>
      )}

      {locations.length === 0 && !showAdd && (
        <div className="rounded-2xl border border-dashed border-parchment-dark bg-white/50 px-6 py-12 text-center">
          <MapPin size={28} className="mx-auto text-gold" />
          <p className="mt-3 font-medium text-ink">No exact pins saved yet</p>
          <p className="mt-1 text-sm text-muted">Add the family home, church, cemetery, or reception venue.</p>
        </div>
      )}

      {locations.map((location, index) => {
        const draft = drafts[location.id] || toDraft(location);
        const typeLabel = LOCATION_TYPES.find((type) => type.value === location.type)?.label || 'Location';
        return (
          <article key={location.id} className="rounded-2xl border border-parchment-dark bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-3 border-b border-parchment-dark pb-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-gold-light"><MapPin size={18} /></span>
                <div>
                  <p className="font-display text-xl font-semibold text-ink">{draft.name || typeLabel}</p>
                  <p className="text-xs uppercase tracking-wider text-muted">{typeLabel} · Pin {index + 1}</p>
                </div>
              </div>
              <div className="flex gap-1">
                <button type="button" onClick={() => moveLocation(index, -1)} disabled={index === 0 || working === 'reorder'} aria-label={`Move ${location.name} up`} className="rounded-lg p-2 text-muted hover:bg-parchment hover:text-ink disabled:opacity-30"><ArrowUp size={16} /></button>
                <button type="button" onClick={() => moveLocation(index, 1)} disabled={index === locations.length - 1 || working === 'reorder'} aria-label={`Move ${location.name} down`} className="rounded-lg p-2 text-muted hover:bg-parchment hover:text-ink disabled:opacity-30"><ArrowDown size={16} /></button>
              </div>
            </div>

            <LocationFields
              draft={draft}
              onChange={(nextDraft) => updateDraft(location.id, nextDraft)}
              locating={locating === location.id}
              onUseCurrentLocation={() => captureCurrentLocation(location.id, (latitude, longitude) => updateDraft(location.id, { ...draft, latitude, longitude }))}
            />

            <div className="mt-5 flex flex-col-reverse gap-2 border-t border-parchment-dark pt-5 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => deleteLocation(location)} disabled={working === location.id} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={16} /> Delete location</button>
              <button type="button" onClick={() => saveLocation(location)} disabled={working === location.id} className="inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-parchment transition hover:bg-ink-light disabled:opacity-50"><Save size={16} /> {working === location.id ? 'Saving…' : 'Save changes'}</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
