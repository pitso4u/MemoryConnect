import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(testDir, '../../public');
const brandDir = path.join(publicDir, 'brand');

function pngDimensions(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  expect(buffer.length).toBeGreaterThan(0);
  expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  expect(buffer.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

describe('Memory Connect brand assets', () => {
  it('ships required PNG logo variants with exact icon dimensions', () => {
    const expected = new Map([
      ['memory-connect-icon-192.png', [192, 192]],
      ['memory-connect-icon-512.png', [512, 512]],
      ['memory-connect-apple-touch-icon.png', [180, 180]],
      ['memory-connect-og-1200x630.png', [1200, 630]],
      ['memory-connect-favicon-32.png', [32, 32]],
      ['memory-connect-favicon-16.png', [16, 16]],
    ]);
    for (const fileName of ['memory-connect-emblem.png', 'memory-connect-logo-horizontal.png', 'memory-connect-logo-full.png', ...expected.keys()]) {
      const filePath = path.join(brandDir, fileName);
      expect(fs.existsSync(filePath), fileName).toBe(true);
      const dimensions = pngDimensions(filePath);
      const exact = expected.get(fileName);
      if (exact) expect(dimensions).toEqual({ width: exact[0], height: exact[1] });
    }
  });

  it('manifest icon paths resolve and old PWA icon paths are gone', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(publicDir, 'manifest.webmanifest'), 'utf8'));
    expect(manifest.icons).toEqual([
      expect.objectContaining({ src: '/brand/memory-connect-icon-192.png', sizes: '192x192' }),
      expect.objectContaining({ src: '/brand/memory-connect-icon-512.png', sizes: '512x512' }),
    ]);
    for (const icon of manifest.icons) {
      expect(fs.existsSync(path.join(publicDir, icon.src))).toBe(true);
    }

    const html = fs.readFileSync(path.resolve(testDir, '../../index.html'), 'utf8');
    expect(html).toContain('/brand/memory-connect-og-1200x630.png');
    expect(html).toContain('/brand/memory-connect-favicon-32.png');
    expect(html).not.toContain('/pwa-192.png');
    expect(html).not.toContain('/pwa-512.png');
  });
});
