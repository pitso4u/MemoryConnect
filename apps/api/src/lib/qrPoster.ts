import fs from 'fs';
import path from 'path';
import { PDFDocument, PDFFont, PDFImage, PDFPage, RotationTypes, StandardFonts, rgb } from 'pdf-lib';
import * as operators from 'pdf-lib/cjs/api/operators';
import PDFContentStream from 'pdf-lib/cjs/core/structures/PDFContentStream';
import QRCode from 'qrcode';
import { prisma } from './prisma';
import { env } from './env';
import { UPLOADS_DIR } from './uploads';

const MC_LOGO_PATH = path.resolve(__dirname, '../../assets/memory-connect-logo-full.png');

// ── Palette ────────────────────────────────────────────────────────────────
const NAVY = rgb(0x1f / 255, 0x22 / 255, 0x3a / 255); // #1F223A
const GREEN = rgb(0x7b / 255, 0xcb / 255, 0x68 / 255); // #7BCB68
const GREY = rgb(0x6e / 255, 0x72 / 255, 0x80 / 255); // #6E7280
const BORDER = rgb(0xe8 / 255, 0xe8 / 255, 0xe8 / 255); // #E8E8E8
const DEFAULT_ACCENT = '#7BCB68';

/** Feather-style stroke icons (24x24 viewBox). */
const SVG_ICONS = {
  phone:
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zm-4 0a4 4 0 1 0-8 0 4 4 0 0 0 8 0z',
  calendar: 'M8 2v4M16 2v4M3 9h18M5 4h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  clock:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l4 2.5 1-1.7L13 10V7z',
} as const;

/** Small elegant leaf, origin at its base, pointing "up" in SVG space. */
const LEAF = 'M0 0 C 4 -4 8 -14 6 -22 C -2 -18 -7 -10 0 0 Z';

function hexRgb(hex: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return GREEN;
  const n = parseInt(match[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

function readEmbeddableImage(filePath: string): { buffer: Buffer; kind: 'png' | 'jpg' } | null {
  try {
    const buffer = fs.readFileSync(filePath);
    if (buffer.length > 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return { buffer, kind: 'png' };
    }
    if (buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { buffer, kind: 'jpg' };
    }
    return null;
  } catch {
    return null;
  }
}

/** Map a public `/uploads/...` URL to its on-disk path under UPLOADS_DIR. */
export function uploadPathFromUrl(url: string): string {
  if (!url || !url.startsWith('/uploads/')) return '';
  return path.join(UPLOADS_DIR, url.replace(/^\/uploads\//, ''));
}

export interface QrPosterInput {
  funeralHomeName: string;
  logoUrl?: string | null;
  portraitUrl?: string | null;
  memorialUrl: string;
  deceasedName?: string | null;
  eventDateLabel?: string | null;
  eventTime?: string | null;
  eventVenue?: string | null;
  accentColor?: string | null;
  includeEventInfo?: boolean;
}

export function memorialShortUrl(memorialUrl: string): string {
  return memorialUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

export function memorialBaseUrl(): string {
  if (env.MEMORIAL_URL) return env.MEMORIAL_URL.replace(/\/$/, '');
  return 'https://memoryconnect.co.za';
}

/** Round-rect path in a local (0,0)-top-left, y-down coordinate space. */
function roundedRectPath(x: number, y: number, w: number, h: number, r: number): string {
  return (
    `M ${x + r} ${y} H ${x + w - r} ` +
    `A ${r} ${r} 0 0 1 ${x + w} ${y + r} V ${y + h - r} ` +
    `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} ` +
    `A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} ` +
    `A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
  );
}

/**
 * Draw an image cropped to a perfect circle using a clip in a scratch PDF page,
 * then compose it onto the target page (order preserved, no square corners).
 */
async function drawCircularPortrait(
  page: PDFPage,
  imageBuffer: Buffer,
  kind: 'png' | 'jpg',
  centerX: number,
  centerY: number,
  radius: number,
): Promise<void> {
  const d = radius * 2;
  const inner = await PDFDocument.create();
  const innerPage = inner.addPage([d, d]);
  const img = kind === 'png' ? await inner.embedPng(imageBuffer) : await inner.embedJpg(imageBuffer);
  const key = innerPage.node.newXObject('Image', img.ref);
  const k = 0.5522847498307936;
  const ops = [
    operators.pushGraphicsState(),
    operators.moveTo(d, radius),
    operators.appendBezierCurve(d, radius + k * radius, radius + k * radius, d, radius, d),
    operators.appendBezierCurve(radius - k * radius, d, 0, radius + k * radius, 0, radius),
    operators.appendBezierCurve(0, radius - k * radius, radius - k * radius, 0, radius, 0),
    operators.appendBezierCurve(radius + k * radius, 0, d, radius - k * radius, d, radius),
    operators.closePath(),
    operators.clip(),
    operators.translate(0, 0),
    operators.rotateRadians(0),
    operators.scale(d, d),
    operators.skewRadians(0, 0),
    operators.drawObject(key),
    operators.popGraphicsState(),
  ];
  const dict = inner.context.obj({});
  const stream = PDFContentStream.of(dict, ops);
  innerPage.node.addContentStream(inner.context.register(stream));
  const [embedded] = await page.doc.embedPdf(inner);
  page.drawPage(embedded, { x: centerX - radius, y: centerY - radius, width: d, height: d });
}

export async function generateQrPosterPdf(input: QrPosterInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const page: PDFPage = pdf.addPage([595.28, 841.89]);
  const H = page.getHeight();
  const W = page.getWidth();

  const fontSerif = await pdf.embedFont(StandardFonts.TimesRoman);
  const fontSerifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const fontSans = await pdf.embedFont(StandardFonts.Helvetica);
  const fontSansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const accent = input.accentColor ? hexRgb(input.accentColor) : hexRgb(DEFAULT_ACCENT);

  const fhLogo = input.logoUrl ? readEmbeddableImage(uploadPathFromUrl(input.logoUrl)) : null;
  let fhLogoImage: PDFImage | null = null;
  if (fhLogo) fhLogoImage = fhLogo.kind === 'png' ? await pdf.embedPng(fhLogo.buffer) : await pdf.embedJpg(fhLogo.buffer);

  const portrait = input.portraitUrl ? readEmbeddableImage(uploadPathFromUrl(input.portraitUrl)) : null;

  const mcLogo = readEmbeddableImage(MC_LOGO_PATH);
  const mcLogoImage = mcLogo ? (mcLogo.kind === 'png' ? await pdf.embedPng(mcLogo.buffer) : await pdf.embedJpg(mcLogo.buffer)) : null;

  const MARGIN = 50;
  const contentWidth = W - MARGIN * 2;
  let top = 28;

  function fitSize(font: PDFFont, text: string, size: number, maxWidth: number): number {
    let s = size;
    while (s > 8 && font.widthOfTextAtSize(text, s) > maxWidth) s -= 0.5;
    return s;
  }

  function drawCentered(text: string, size: number, font: PDFFont, color: ReturnType<typeof rgb>, leading = 1.25): number {
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (W - width) / 2, y: H - top - size * 0.8, size, font, color });
    const advance = size * leading;
    top += advance;
    return advance;
  }

  /** Draw an SVG path whose top-left lands at top-based (x, topY). */
  function drawSvgAt(path: string, x: number, topY: number, opts: { scale?: number; rotate?: number; color?: ReturnType<typeof rgb>; borderColor?: ReturnType<typeof rgb>; borderWidth?: number; opacity?: number }) {
    page.drawSvgPath(path, {
      x,
      y: H - topY,
      scale: opts.scale ?? 1,
      rotate: opts.rotate ? { type: RotationTypes.Degrees, angle: opts.rotate } : undefined,
      color: opts.color,
      borderColor: opts.borderColor,
      borderWidth: opts.borderWidth,
      opacity: opts.opacity,
    });
  }

  // ── Decorative botanical corners (drawn first, behind everything) ──────────
  const cornerSprigs: Array<[number, number]> = [
    [MARGIN + 8, top + 8],
    [W - MARGIN - 8, top + 8],
    [MARGIN + 8, H - MARGIN - 8],
    [W - MARGIN - 8, H - MARGIN - 8],
  ];
  for (const [cx, cy] of cornerSprigs) {
    const isRight = cx > W / 2;
    const isBottom = cy > H / 2;
    const baseAngle = (isRight ? -20 : 20) + (isBottom ? 180 : 0);
    for (let i = 0; i < 3; i++) {
      drawSvgAt(LEAF, cx - 10, cy - 10 + (isBottom ? -10 : 0), {
        scale: 1.1,
        rotate: baseAngle + (i - 1) * 18,
        color: GREEN,
        opacity: 0.12,
      });
    }
  }

  // ── Section 1: Funeral home branding ─────────────────────────────────────
  if (fhLogoImage) {
    const maxH = 42;
    const maxW = 200;
    const ratio = Math.min(maxW / fhLogoImage.width, maxH / fhLogoImage.height);
    const w = fhLogoImage.width * ratio;
    const h = fhLogoImage.height * ratio;
    page.drawImage(fhLogoImage, { x: (W - w) / 2, y: H - top - h, width: w, height: h });
    top += h + 12;
  }

  const nameText = input.funeralHomeName || 'Memory Connect';
  const nameSize = fitSize(fontSerifBold, nameText, 20, contentWidth);
  drawCentered(nameText, nameSize, fontSerifBold, NAVY, 1.25);
  top += 6;

  // Decorative divider: ─────────●────────
  const dividerHalf = 90;
  const dividerY = H - top - 1.5;
  page.drawLine({ start: { x: W / 2 - dividerHalf, y: dividerY }, end: { x: W / 2 - 6, y: dividerY }, thickness: 1.1, color: accent });
  page.drawLine({ start: { x: W / 2 + 6, y: dividerY }, end: { x: W / 2 + dividerHalf, y: dividerY }, thickness: 1.1, color: accent });
  page.drawCircle({ x: W / 2, y: dividerY, size: 1.8, color: accent });
  top += 14;

  // ── Section 2: Main heading ───────────────────────────────────────────────
  const headingLines = ['Scan Here For The', 'Digital Programme'];
  const phoneSize = 30;
  const headingBudget = contentWidth - phoneSize - 10;
  const headingSize = fitSize(fontSerifBold, headingLines[1], 30, headingBudget);
  for (let i = 0; i < headingLines.length; i++) {
    const line = headingLines[i];
    const width = fontSerifBold.widthOfTextAtSize(line, headingSize);
    const x = (W - width) / 2;
    const baseline = H - top - headingSize * 0.8;
    page.drawText(line, { x, y: baseline, size: headingSize, font: fontSerifBold, color: NAVY });
    if (i === 0) {
      drawSvgAt(SVG_ICONS.phone, x - 8 - phoneSize, H - baseline + headingSize * 0.35, {
        scale: phoneSize / 24,
        borderColor: accent,
        borderWidth: 1.5,
      });
    }
    top += headingSize * 1.15;
  }
  top += 6;

  // ── Section 3: Features + portrait ────────────────────────────────────────
  drawCentered('Scan using your phone\u2019s camera to view:', 9, fontSans, GREY, 1.25);
  top += 8;

  const leftFeatures = ['Digital Programme', 'Photo Gallery', 'Family Tributes'];
  const rightFeatures = ['Order of Service', 'Livestream', 'Messages & Memories'];
  const portraitDiameter = 114;
  const portraitRadius = portraitDiameter / 2;
  const sideGap = 36;
  const sideWidth = (contentWidth - portraitDiameter - sideGap * 2) / 2;
  const portraitCenterY = top + portraitDiameter / 2 + 6;

  // Botanical leaves behind the portrait
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * 360 - 60;
    const rad = (angle * Math.PI) / 180;
    const lx = W / 2 + Math.cos(rad) * (portraitRadius + 9);
    const ly = H - portraitCenterY + Math.sin(rad) * (portraitRadius + 9);
    drawSvgAt(LEAF, lx - 8, H - ly + 8, { scale: 0.9, rotate: angle, color: GREEN, opacity: 0.14 });
  }

  const featureSize = 9.5;
  const featureAdvance = featureSize * 1.55;
  for (let r = 0; r < 3; r++) {
    const rowY = top + 4 + r * featureAdvance;
    for (const [items, anchor] of [[leftFeatures, MARGIN + sideWidth / 2], [rightFeatures, W - MARGIN - sideWidth / 2]] as const) {
      const item = items[r];
      const bulletWidth = fontSansBold.widthOfTextAtSize('\u2022', featureSize);
      const textWidth = fontSans.widthOfTextAtSize(item, featureSize);
      const total = bulletWidth + 5 + textWidth;
      const x = anchor - total / 2;
      const baseline = H - rowY - featureSize * 0.8;
      page.drawText('\u2022', { x, y: baseline, size: featureSize, font: fontSansBold, color: accent });
      page.drawText(item, { x: x + bulletWidth + 5, y: baseline, size: featureSize, font: fontSans, color: NAVY });
    }
  }

  // Circular portrait (photo or placeholder) + green ring
  if (portrait) {
    await drawCircularPortrait(page, portrait.buffer, portrait.kind, W / 2, portraitCenterY, portraitRadius);
  } else {
    page.drawCircle({ x: W / 2, y: portraitCenterY, size: portraitRadius, color: rgb(0.97, 0.97, 0.98) });
    const placeholder = 'Photo Coming Soon';
    const phSize = 9;
    const phWidth = fontSansBold.widthOfTextAtSize(placeholder, phSize);
    page.drawText('Photo', { x: W / 2, y: portraitCenterY + 2, size: phSize, font: fontSansBold, color: GREY });
    page.drawText('Coming Soon', { x: W / 2, y: portraitCenterY - 8, size: phSize, font: fontSansBold, color: GREY });
    void phWidth;
  }
  page.drawCircle({ x: W / 2, y: portraitCenterY, size: portraitRadius, borderColor: accent, borderWidth: 2.2 });
  top += portraitDiameter + 12;

  // ── Section 4: Memorial details ───────────────────────────────────────────
  if (input.includeEventInfo && input.deceasedName) {
    const label = 'IN LOVING MEMORY OF';
    const labelWidth = fontSansBold.widthOfTextAtSize(label, 7.5);
    page.drawText(label, { x: (W - labelWidth) / 2, y: H - top - 6, size: 7.5, font: fontSansBold, color: accent });
    top += 11;

    const decSize = fitSize(fontSerifBold, input.deceasedName, 24, contentWidth);
    drawCentered(input.deceasedName, decSize, fontSerifBold, NAVY, 1.2);
    top += 4;

    const details: Array<{ icon: keyof typeof SVG_ICONS; text?: string | null }> = [];
    if (input.eventVenue) details.push({ icon: 'pin', text: input.eventVenue });
    if (input.eventDateLabel) details.push({ icon: 'calendar', text: input.eventDateLabel });
    if (input.eventTime) details.push({ icon: 'clock', text: input.eventTime });
    const present = details.filter((d) => d.text);

    if (present.length > 0) {
      const dSize = 9.5;
      const cellWidth = contentWidth / present.length;
      const cellCenters = present.map((_, i) => MARGIN + cellWidth * i + cellWidth / 2);
      const rowY = top + dSize * 0.6;
      const baseline = H - rowY - dSize * 0.8;

      for (let i = 0; i < present.length; i++) {
        const text = present[i].text as string;
        const iconSize = 10.5;
        const textWidth = fontSans.widthOfTextAtSize(text, dSize);
        const total = iconSize + 4 + textWidth;
        const x = cellCenters[i] - total / 2;
        drawSvgAt(SVG_ICONS[present[i].icon], x, rowY + dSize * 0.25, { scale: iconSize / 24, borderColor: GREY, borderWidth: 1.4 });
        page.drawText(text, { x: x + iconSize + 4, y: baseline, size: dSize, font: fontSans, color: GREY });

        if (i < present.length - 1) {
          const dividerX = cellCenters[i] + cellWidth / 2;
          page.drawLine({ start: { x: dividerX, y: rowY - 2 }, end: { x: dividerX, y: rowY + dSize + 2 }, thickness: 0.8, color: BORDER });
        }
      }
      top += dSize * 1.5 + 4;
    }

    drawCentered('Share this memorial with family and friends.', 8.5, fontSans, GREY, 1.2);
    top += 8;
  }

  // ── Section 5: QR code (vector, focal point) ──────────────────────────────
  const footerReserve = 96;
  const targetQr = 318;
  const qrSize = Math.min(targetQr, Math.max(240, H - top - footerReserve));

  const qr = QRCode.create(input.memorialUrl, { errorCorrectionLevel: 'H' });
  const qrN = qr.modules.size;
  const quiet = 4;
  const totalCells = qrN + quiet * 2;
  const cell = qrSize / totalCells;
  const qrLeft = (W - qrSize) / 2;
  const qrTop = top;
  for (let row = 0; row < totalCells; row++) {
    for (let col = 0; col < totalCells; col++) {
      const dark = row >= quiet && col >= quiet && row < quiet + qrN && col < quiet + qrN ? qr.modules.get(row - quiet, col - quiet) : 0;
      if (dark) {
        page.drawRectangle({
          x: qrLeft + col * cell,
          y: H - qrTop - (row + 1) * cell,
          width: cell + 0.15,
          height: cell + 0.15,
          color: NAVY,
        });
      }
    }
  }

  const borderPad = 13;
  const borderRadius = 13;
  drawSvgAt(
    roundedRectPath(-borderPad, -borderPad, qrSize + borderPad * 2, qrSize + borderPad * 2, borderRadius),
    qrLeft,
    qrTop,
    { borderColor: accent, borderWidth: 1.2 },
  );
  top += qrSize + borderPad * 2 + 10;

  // Short URL (bold)
  const shortUrl = memorialShortUrl(input.memorialUrl);
  const urlSize = fitSize(fontSansBold, shortUrl, 10.5, contentWidth);
  drawCentered(shortUrl, urlSize, fontSansBold, NAVY, 1.2);
  top += 6;

  // ── QR instruction ────────────────────────────────────────────────────────
  const instrSize = 8.5;
  drawSvgAt(SVG_ICONS.phone, W / 2 - 6, top + 2, { scale: 11 / 24, borderColor: accent, borderWidth: 1.4 });
  drawCentered('Open your phone\u2019s camera', instrSize, fontSans, GREY, 1.3);
  drawCentered('and point it at the QR code.', instrSize, fontSans, GREY, 1.3);
  top += 10;

  // ── Section 6: Powered by MemoryConnect ───────────────────────────────────
  page.drawLine({ start: { x: W / 2 - 45, y: H - top }, end: { x: W / 2 + 45, y: H - top }, thickness: 1, color: BORDER });
  top += 8;
  drawCentered('Powered by', 7, fontSans, GREY, 1.2);
  top += 2;
  if (mcLogoImage) {
    const maxH = 13;
    const maxW = 120;
    const ratio = Math.min(maxW / mcLogoImage.width, maxH / mcLogoImage.height);
    const w = mcLogoImage.width * ratio;
    const h = mcLogoImage.height * ratio;
    page.drawImage(mcLogoImage, { x: (W - w) / 2, y: H - top - h, width: w, height: h });
    top += h + 3;
  }
  drawCentered('MemoryConnect', 8.5, fontSans, GREY, 1.2);
  drawCentered('memoryconnect.co.za', 8, fontSans, GREY, 1.2);

  if (top > H - 22) {
    console.warn(`QR poster layout overflow: content ends at ${top.toFixed(1)}pt of ${H.toFixed(1)}pt`);
  }

  return Buffer.from(await pdf.save());
}

export function formatEventDate(date: Date, timezone?: string | null): string {
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone || 'Africa/Johannesburg',
    }).format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

export function formatEventTime(date: Date, timezone?: string | null): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone || 'Africa/Johannesburg',
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '';
    const period = (parts.find((p) => p.type === 'dayPeriod')?.value ?? '').toUpperCase();
    return `${hour}:${minute} ${period}`.trim();
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

/**
 * Generate the A4 QR poster PDF for a memorial and return its public URL.
 * Best-effort: returns null on any failure so publishing is never blocked.
 */
export async function autoGenerateQrPoster(memorialId: string): Promise<string | null> {
  try {
    const memorial = await prisma.memorial.findUnique({
      where: { id: memorialId },
      include: { funeralHome: true },
    });
    if (!memorial) return null;

    const memorialUrl = `${memorialBaseUrl()}/${memorial.slug}`;
    const dateLabel = memorial.serviceDate ? formatEventDate(memorial.serviceDate, memorial.timezone) : null;
    const eventTime = memorial.serviceDate ? formatEventTime(memorial.serviceDate, memorial.timezone) : null;

    const posterDir = path.join(UPLOADS_DIR, 'posters');
    fs.mkdirSync(posterDir, { recursive: true });
    const filename = `${memorial.slug}.pdf`;
    const pdfPath = path.join(posterDir, filename);

    const bytes = await generateQrPosterPdf({
      funeralHomeName: memorial.funeralHome.tradingName || memorial.funeralHome.name,
      logoUrl: memorial.logoUrl || memorial.funeralHome.logoUrl,
      portraitUrl: memorial.deceasedPhotoUrl,
      memorialUrl,
      deceasedName: memorial.deceasedName,
      eventDateLabel: dateLabel,
      eventTime,
      eventVenue: memorial.serviceVenue,
      includeEventInfo: true,
    });

    fs.writeFileSync(pdfPath, bytes);
    return `/uploads/posters/${filename}`;
  } catch (error) {
    console.error('QR poster auto-generation failed:', error);
    return null;
  }
}
