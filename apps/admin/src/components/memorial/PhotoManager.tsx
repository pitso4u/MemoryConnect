import { Upload, Trash2 } from 'lucide-react';
import { Photo } from '@memorialconnect/shared';
import { photoUrl } from '../../lib/api';

const PHOTO_CATEGORIES = [
  { value: 'childhood', label: 'Childhood' },
  { value: 'school', label: 'School' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'family', label: 'Family' },
  { value: 'friends', label: 'Friends' },
  { value: 'recent', label: 'Recent' },
  { value: 'other', label: 'Other' },
] as const;

interface PhotoManagerProps {
  photos: Photo[];
  category: string;
  caption: string;
  uploading: boolean;
  uploadError: string;
  onCategoryChange: (category: string) => void;
  onCaptionChange: (caption: string) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDelete: (photoId: string) => void;
}

export function PhotoManager({
  photos,
  category,
  caption,
  uploading,
  uploadError,
  onCategoryChange,
  onCaptionChange,
  onUpload,
  onDelete,
}: PhotoManagerProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-parchment-dark p-6">
        <h3 className="font-medium mb-4">Upload photos</h3>
        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-parchment-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/40"
            >
              {PHOTO_CATEGORIES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Caption (optional)</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => onCaptionChange(e.target.value)}
              placeholder="e.g. Wedding day, 1985"
              className="w-full px-3 py-2 text-sm border border-parchment-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-gold/40"
            />
          </div>
        </div>
        {uploadError && (
          <p className="text-sm text-red-600 mb-3">{uploadError}</p>
        )}
        <label className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-parchment-dark rounded-xl cursor-pointer hover:border-gold hover:bg-gold/5 transition">
          <Upload size={28} className="text-muted mb-2" />
          <span className="text-sm font-medium text-ink">
            {uploading ? 'Uploading...' : 'Click to select photos'}
          </span>
          <span className="text-xs text-muted mt-1">JPEG, PNG, WebP, or GIF — up to 10 MB each</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            disabled={uploading}
            onChange={onUpload}
            className="hidden"
          />
        </label>
      </div>

      {photos.length === 0 ? (
        <p className="text-center text-muted py-8 text-sm">No photos uploaded yet</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative bg-white rounded-lg border border-parchment-dark overflow-hidden">
              <img
                src={photoUrl(photo.url)}
                alt={photo.caption || ''}
                className="aspect-square w-full object-cover"
              />
              <div className="p-2">
                <p className="text-xs text-muted capitalize">{photo.category}</p>
                {photo.caption && <p className="text-xs text-ink truncate">{photo.caption}</p>}
              </div>
              <button
                type="button"
                onClick={() => onDelete(photo.id)}
                className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg text-muted hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                title="Delete photo"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
