import { Router, Request } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { ensureUploadsDir, photoPublicUrl, UPLOADS_DIR } from '../lib/uploads';
import { isEditLocked } from '../lib/publishing';

const router = Router({ mergeParams: true });

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function paramPhotoId(req: Request): string {
  const id = req.params.photoId;
  return Array.isArray(id) ? id[0] : id;
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const memorialId = paramId(req);
    cb(null, ensureUploadsDir(memorialId));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
    }
  },
});

router.post('/', authenticate, (req, res) => {
  const memorialId = paramId(req);
  upload.array('photos', 20)(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    try {
      const memorial = await prisma.memorial.findFirst({
        where: { id: memorialId, funeralHomeId: req.user!.funeralHomeId },
        include: { photos: true },
      });

      if (!memorial) {
        return res.status(404).json({ success: false, error: 'Memorial not found' });
      }

      const files = req.files as Express.Multer.File[];
      if (!files?.length) {
        return res.status(400).json({ success: false, error: 'No photos provided' });
      }

      if (isEditLocked(memorial) && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') {
        for (const file of (req.files as Express.Multer.File[]) || []) if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return res.status(423).json({ success: false, error: 'This funeral programme is locked because it has already been published and shared.' });
      }
      const incomingBytes = files.reduce((sum, file) => sum + file.size, 0);
      const category = typeof req.body.category === 'string' ? req.body.category : 'other';
      const caption = typeof req.body.caption === 'string' ? req.body.caption : undefined;
      const startOrder = memorial.photos.length;

      const photos = await Promise.all(
        files.map((file, index) =>
          prisma.photo.create({
            data: {
              memorialId,
              url: photoPublicUrl(memorialId, file.filename),
              caption: files.length === 1 ? caption : undefined,
              category,
              order: startOrder + index,
              storageBytes: file.size,
            },
          })
        )
      );

      await prisma.memorial.update({
        where: { id: memorialId },
        data: {
          storageBytes: { increment: incomingBytes },
          deceasedPhotoUrl: memorial.deceasedPhotoUrl || photos[0]?.url,
        },
      });

      res.status(201).json({ success: true, data: photos });
    } catch (error) {
      console.error('Photo upload error:', error);
      res.status(500).json({ success: false, error: 'Failed to upload photos' });
    }
  });
});

router.delete('/:photoId', authenticate, async (req, res) => {
  try {
    const memorialId = paramId(req);
    const photoId = paramPhotoId(req);

    const memorial = await prisma.memorial.findFirst({
      where: { id: memorialId, funeralHomeId: req.user!.funeralHomeId },
    });

    if (!memorial) {
      return res.status(404).json({ success: false, error: 'Memorial not found' });
    }

    const photo = await prisma.photo.findFirst({
      where: { id: photoId, memorialId },
    });

    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found' });
    }

    const filename = path.basename(photo.url);
    const filePath = path.join(UPLOADS_DIR, memorialId, filename);
    let bytesFreed = photo.storageBytes || 0;
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      bytesFreed = stat.size || bytesFreed;
      fs.unlinkSync(filePath);
    }

    if (isEditLocked(memorial) && req.user!.role.toUpperCase() !== 'SUPER_ADMIN') {
      return res.status(423).json({ success: false, error: 'This funeral programme is locked because it has already been published and shared.' });
    }

    await prisma.$transaction([
      prisma.photo.update({ where: { id: photoId }, data: { deletedAt: new Date(), storageBytes: 0 } }),
      prisma.memorial.update({
        where: { id: memorialId },
        data: {
          storageBytes: { decrement: bytesFreed },
          deceasedPhotoUrl: memorial.deceasedPhotoUrl === photo.url ? null : undefined,
        },
      }),
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error('Photo delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete photo' });
  }
});

export default router;
