import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authenticateEvents } from '../lib/auth';
import { ensureEventUploadsDir, eventPhotoPublicUrl } from '../lib/uploads';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const eventId = (req.params as { id?: string }).id as string;
    cb(null, ensureEventUploadsDir(eventId));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  },
});

// MIME headers can be spoofed, so verify the actual file signature
// (magic bytes) before accepting an upload.
function hasValidImageSignature(filePath: string, mimetype: string): boolean {
  const header = Buffer.alloc(12);
  const fd = fs.openSync(filePath, 'r');
  try {
    fs.readSync(fd, header, 0, 12, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (mimetype === 'image/png') return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4e && header[3] === 0x47;
  if (mimetype === 'image/jpeg') return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  if (mimetype === 'image/gif') return header.toString('ascii', 0, 6) === 'GIF87a' || header.toString('ascii', 0, 6) === 'GIF89a';
  if (mimetype === 'image/webp') {
    return header.toString('ascii', 0, 4) === 'RIFF' && header.toString('ascii', 8, 12) === 'WEBP';
  }
  return false;
}

router.post('/:id/photos', authenticateEvents, (req, res) => {
  const eventId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  prisma.event
    .findFirst({ where: { id: eventId, organiserId: req.eventsUser!.organiserId } })
    .then((event) => {
      if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
      upload.single('photo')(req, res, async (err) => {
        if (err) return res.status(400).json({ success: false, error: err.message });
        try {
          const file = req.file as Express.Multer.File | undefined;
          if (!file) return res.status(400).json({ success: false, error: 'No photo file provided' });
          if (!hasValidImageSignature(file.path, file.mimetype)) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ success: false, error: 'File content does not match its image type' });
          }
          const count = await prisma.eventPhoto.count({ where: { eventId } });
          const photo = await prisma.eventPhoto.create({
            data: {
              eventId,
              url: eventPhotoPublicUrl(eventId, file.filename),
              caption: typeof req.body?.caption === 'string' ? req.body.caption.slice(0, 300) : null,
              order: count,
            },
          });
          res.status(201).json({ success: true, data: photo });
        } catch (error) {
          console.error(error);
          res.status(500).json({ success: false, error: 'Failed to upload photo' });
        }
      });
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ success: false, error: 'Failed to upload photo' });
    });
});

router.delete('/:id/photos/:photoId', authenticateEvents, async (req, res) => {
  const eventId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const photoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;
  const event = await prisma.event.findFirst({ where: { id: eventId, organiserId: req.eventsUser!.organiserId } });
  if (!event) return res.status(404).json({ success: false, error: 'Event not found' });
  const photo = await prisma.eventPhoto.findFirst({ where: { id: photoId, eventId } });
  if (!photo) return res.status(404).json({ success: false, error: 'Photo not found' });
  await prisma.eventPhoto.delete({ where: { id: photo.id } });
  // Best-effort file removal; URL format is /uploads/<eventId>/<file>
  try {
    const filename = photo.url.split('/').pop();
    if (filename) fs.unlinkSync(path.join(ensureEventUploadsDir(eventId), filename));
  } catch {
    // ignore
  }
  res.json({ success: true, data: { deleted: true } });
});

export default router;
