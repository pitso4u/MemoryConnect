import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brandDir = path.join(root, 'apps', 'memorial', 'public', 'brand');

const required = [
  ['memory-connect-emblem.png'],
  ['memory-connect-logo-horizontal.png'],
  ['memory-connect-logo-full.png'],
  ['memory-connect-icon-192.png', 192, 192],
  ['memory-connect-icon-512.png', 512, 512],
  ['memory-connect-apple-touch-icon.png', 180, 180],
  ['memory-connect-og-1200x630.png', 1200, 630],
  ['memory-connect-favicon-32.png', 32, 32],
  ['memory-connect-favicon-16.png', 16, 16],
];

function readPngHeader(filePath) {
  const buffer = fs.readFileSync(filePath);
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(pngSignature)) {
    const start = buffer.subarray(0, Math.min(buffer.length, 80)).toString('utf8').trim();
    throw new Error(`Expected a PNG file. First bytes: ${JSON.stringify(start)}`);
  }
  if (buffer.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error('PNG is missing an IHDR chunk');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
    size: buffer.length,
  };
}

const failures = [];

for (const [fileName, expectedWidth, expectedHeight] of required) {
  const filePath = path.join(brandDir, fileName);
  try {
    if (!fs.existsSync(filePath)) throw new Error('Missing required file');
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size === 0) throw new Error('File is empty or not a regular file');
    const dimensions = readPngHeader(filePath);
    if (!dimensions.width || !dimensions.height) throw new Error('PNG has invalid dimensions');
    if (expectedWidth && dimensions.width !== expectedWidth) {
      throw new Error(`Expected width ${expectedWidth}px, got ${dimensions.width}px`);
    }
    if (expectedHeight && dimensions.height !== expectedHeight) {
      throw new Error(`Expected height ${expectedHeight}px, got ${dimensions.height}px`);
    }
  } catch (error) {
    failures.push(`${fileName}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length) {
  console.error('Brand asset validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Validated ${required.length} Memory Connect brand asset(s).`);
