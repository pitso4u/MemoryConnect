import QRCode from 'qrcode';
import { PDFDocument } from 'pdf-lib';
import { photoUrl } from './api';

export const QR_POSTER_WIDTH = 2480;
export const QR_POSTER_HEIGHT = 3508;

const INK = '#1F223A';
const MUTED = '#6E7280';
const ACCENT = '#7BCB68';
const BORDER = '#E8E8E8';
const MC_LOGO_SRC = '/brand/memory-connect-logo-full.png';
const SERIF = '"Georgia", "Times New Roman", serif';
const SANS = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

/** Page-space scale factor: canvas px per PDF point (A4 @ 300 DPI). */
const S = QR_POSTER_WIDTH / 595.28;

/** Feather-style stroke icons (24x24 viewBox). */
const SVG_ICONS = {
  phone:
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zm-4 0a4 4 0 1 0-8 0 4 4 0 0 0 8 0z',
  calendar: 'M8 2v4M16 2v4M3 9h18M5 4h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z',
  clock:
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-13h-2v6l4 2.5 1-1.7L13 10V7z',
} as const;

export interface QrPosterOptions {
  funeralHomeName: string;
  logoUrl?: string | null;
  portraitUrl?: string | null;
  memorialUrl: string;
  deceasedName?: string | null;
  eventDateLabel?: string | null;
  eventTime?: string | null;
  eventVenue?: string | null;
  includeEventInfo: boolean;
}

function loadImage(src: string, crossOrigin = false): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = crossOrigin ? 'anonymous' : '';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function fitSize(ctx: CanvasRenderingContext2D, text: string, size: number, family: string, weight: string, maxWidth: number): number {
  let s = size;
  while (s > 12) {
    ctx.font = `${weight} ${s}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    s -= 1;
  }
  return s;
}

/**
 * Minimal SVG path parser sufficient for the stroke icons and leaf shapes used
 * on the poster. Draws into a context translated/scaled by the caller.
 */
function traceSvgPath(ctx: CanvasRenderingContext2D, d: string): void {
  const tokens = (d.match(/[a-zA-Z]|[-\d.]+/g) || []).map((t) => (/^[a-zA-Z]$/.test(t) ? t : parseFloat(t)));
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;

  const next = (): number => (typeof tokens[i] === 'number' ? (tokens[i++] as number) : 0);

  const arcTo = (x1: number, y1: number, rx: number, ry: number, xAxisRot: number, large: boolean, sweep: boolean, x2: number, y2: number): void => {
    const ang = (xAxisRot * Math.PI) / 180;
    const cosA = Math.cos(ang);
    const sinA = Math.sin(ang);
    const dx = (x1 - x2) / 2;
    const dy = (y1 - y2) / 2;
    const tx = cosA * dx + sinA * dy;
    const ty = -sinA * dx + cosA * dy;
    const radicand = rx * rx * ry * ry - rx * rx * ty * ty - ry * ry * tx * tx;
    const denom = rx * rx * ty * ty + ry * ry * tx * tx;
    const rad = denom <= 0 || radicand <= 0 ? 0 : Math.sqrt(Math.max(0, radicand / denom));
    const sign = large === sweep ? -1 : 1;
    const cx2 = (sign * rad * rx * ty) / ry;
    const cy2 = (sign * -rad * ry * tx) / rx;
    const cxn = cosA * cx2 - sinA * cy2 + (x1 + x2) / 2;
    const cyn = sinA * cx2 + cosA * cy2 + (y1 + y2) / 2;
    const theta1 = Math.atan2((ty - cy2) / ry, (tx - cx2) / rx);
    const theta2 = Math.atan2((-ty - cy2) / ry, (-tx - cx2) / rx);
    let dtheta = theta2 - theta1;
    if (!sweep && dtheta > 0) dtheta -= 2 * Math.PI;
    else if (sweep && dtheta < 0) dtheta += 2 * Math.PI;
    const steps = Math.max(2, Math.ceil(Math.abs(dtheta) / (Math.PI / 2)));
    for (let s2 = 1; s2 <= steps; s2++) {
      const t1 = theta1 + (dtheta * (s2 - 1)) / steps;
      const t2 = theta1 + (dtheta * s2) / steps;
      const p2x = cxn + rx * cosA * Math.cos(t2) - ry * sinA * Math.sin(t2);
      const p2y = cyn + rx * sinA * Math.cos(t2) + ry * cosA * Math.sin(t2);
      const alpha = (4 / 3) * Math.tan((t2 - t1) / 4);
      const cp1x = cxn + rx * cosA * (Math.cos(t1) - alpha * Math.sin(t1)) - ry * sinA * (Math.sin(t1) + alpha * Math.cos(t1));
      const cp1y = cyn + rx * sinA * (Math.cos(t1) - alpha * Math.sin(t1)) + ry * cosA * (Math.sin(t1) + alpha * Math.cos(t1));
      const cp2x = cxn + rx * cosA * (Math.cos(t2) + alpha * Math.sin(t2)) - ry * sinA * (Math.sin(t2) - alpha * Math.cos(t2));
      const cp2y = cyn + rx * sinA * (Math.cos(t2) + alpha * Math.sin(t2)) + ry * cosA * (Math.sin(t2) - alpha * Math.cos(t2));
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2x, p2y);
      x = p2x;
      y = p2y;
    }
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (typeof t === 'string') {
      cmd = t;
      i++;
      continue;
    }
    const isRel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M':
        x = next();
        y = next();
        if (isRel) {
          x += sx;
          y += sy;
        }
        ctx.moveTo(x, y);
        sx = x;
        sy = y;
        break;
      case 'L':
        x = isRel ? x + next() : next();
        y = isRel ? y + next() : next();
        ctx.lineTo(x, y);
        break;
      case 'H':
        x = isRel ? x + next() : next();
        ctx.lineTo(x, y);
        break;
      case 'V':
        y = isRel ? y + next() : next();
        ctx.lineTo(x, y);
        break;
      case 'C': {
        const x1 = isRel ? x + next() : next();
        const y1 = isRel ? y + next() : next();
        const x2 = isRel ? x + next() : next();
        const y2 = isRel ? y + next() : next();
        const xe = isRel ? x + next() : next();
        const ye = isRel ? y + next() : next();
        ctx.bezierCurveTo(x1, y1, x2, y2, xe, ye);
        x = xe;
        y = ye;
        break;
      }
      case 'A': {
        const rx = next();
        const ry = next();
        const rot = next();
        const large = next() !== 0;
        const sweep = next() !== 0;
        const xe = isRel ? x + next() : next();
        const ye = isRel ? y + next() : next();
        arcTo(x, y, rx, ry, rot, large, sweep, xe, ye);
        x = xe;
        y = ye;
        break;
      }
      case 'Z':
        ctx.closePath();
        x = sx;
        y = sy;
        break;
      default:
        i = tokens.length;
    }
  }
}

function drawSvgPath(
  ctx: CanvasRenderingContext2D,
  d: string,
  x: number,
  y: number,
  scale: number,
  opts: { fill?: string; stroke?: string; lineWidth?: number; alpha?: number },
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.beginPath();
  traceSvgPath(ctx, d);
  if (opts.fill) {
    ctx.fillStyle = opts.fill;
    ctx.fill();
  }
  if (opts.stroke) {
    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = opts.lineWidth ?? 1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.restore();
}

/** Leaf shape drawn with bezier curves (origin at base, pointing up). */
function drawLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, angleDeg: number, color: string, alpha: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(4, -4, 8, -14, 6, -22);
  ctx.bezierCurveTo(-2, -18, -7, -10, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export async function createQrPosterCanvas(options: QrPosterOptions): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = QR_POSTER_WIDTH;
  canvas.height = QR_POSTER_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const W = QR_POSTER_WIDTH;
  const H = QR_POSTER_HEIGHT;
  const pt = (v: number): number => v * S;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const drawText = (text: string, topYpt: number, sizePt: number, family: string, weight: string, color: string): number => {
    const topY = pt(topYpt);
    const size = pt(sizePt);
    ctx.font = `${weight} ${size}px ${family}`;
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, topY);
    return topYpt + sizePt * 1.25;
  };

  const contentWidthPt = 595.28 - 100;
  const MARGIN = 50;

  let top = 28;

  // ── Decorative botanical corners (drawn first, behind everything) ──────────
  const cornerSpots: Array<[number, number]> = [
    [MARGIN + 8, top + 8],
    [595.28 - MARGIN - 8, top + 8],
    [MARGIN + 8, 841.89 - MARGIN - 8],
    [595.28 - MARGIN - 8, 841.89 - MARGIN - 8],
  ];
  for (const [cx, cy] of cornerSpots) {
    const isRight = cx > 595.28 / 2;
    const isBottom = cy > 841.89 / 2;
    const baseAngle = (isRight ? -20 : 20) + (isBottom ? 180 : 0);
    for (let i = 0; i < 3; i++) {
      drawLeaf(ctx, pt(cx), pt(cy + (isBottom ? -10 : 0)), pt(1.1), baseAngle + (i - 1) * 18, ACCENT, 0.12);
    }
  }

  // ── Section 1: Funeral home branding ─────────────────────────────────────
  const logo = options.logoUrl ? await loadImage(photoUrl(options.logoUrl), true) : null;
  if (logo) {
    const maxH = pt(42);
    const maxW = pt(200);
    const ratio = Math.min(maxW / logo.width, maxH / logo.height);
    ctx.drawImage(logo, (W - logo.width * ratio) / 2, pt(top), logo.width * ratio, logo.height * ratio);
    top += (logo.height * ratio) / S + 12;
  }

  const nameText = options.funeralHomeName || 'Memory Connect';
  const nameSize = fitSize(ctx, nameText, pt(20), SERIF, 'bold', pt(contentWidthPt));
  top = drawText(nameText, top, nameSize / S, SERIF, 'bold', INK);
  top += 6;

  // Decorative divider: ─────────●────────
  const dividerHalf = 90;
  const dividerY = pt(top + 1.5);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = pt(1.1);
  ctx.beginPath();
  ctx.moveTo(W / 2 - pt(dividerHalf), dividerY);
  ctx.lineTo(W / 2 - pt(6), dividerY);
  ctx.moveTo(W / 2 + pt(6), dividerY);
  ctx.lineTo(W / 2 + pt(dividerHalf), dividerY);
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.beginPath();
  ctx.arc(W / 2, dividerY, pt(1.8), 0, Math.PI * 2);
  ctx.fill();
  top += 14;

  // ── Section 2: Main heading with phone icon ───────────────────────────────
  const headingLines = ['Scan Here For The', 'Digital Programme'];
  const phoneSize = 30;
  const headingBudget = contentWidthPt - phoneSize - 10;
  const headingSize = fitSize(ctx, headingLines[1], pt(30), SERIF, 'bold', pt(headingBudget)) / S;
  for (let i = 0; i < headingLines.length; i++) {
    const line = headingLines[i];
    ctx.font = `bold ${pt(headingSize)}px ${SERIF}`;
    const width = ctx.measureText(line).width;
    const x = (W - width) / 2;
    ctx.fillStyle = INK;
    ctx.fillText(line, W / 2, pt(top));
    if (i === 0) {
      const iconScale = pt(phoneSize) / 24;
      drawSvgPath(ctx, SVG_ICONS.phone, x - pt(8) - pt(phoneSize) * 0.5, pt(top) + pt(headingSize) * 0.28, iconScale, {
        stroke: ACCENT,
        lineWidth: pt(1.5),
      });
    }
    top += headingSize * 1.15;
  }
  top += 6;

  // ── Section 3: Features + portrait ────────────────────────────────────────
  top = drawText('Scan using your phone\u2019s camera to view:', top, 9, SANS, 'normal', MUTED);
  top += 8;

  const leftFeatures = ['Digital Programme', 'Photo Gallery', 'Family Tributes'];
  const rightFeatures = ['Order of Service', 'Livestream', 'Messages & Memories'];
  const portraitDiameter = 114;
  const portraitRadius = portraitDiameter / 2;
  const sideGap = 36;
  const sideWidth = (contentWidthPt - portraitDiameter - sideGap * 2) / 2;
  const portraitCenterY = top + portraitDiameter / 2 + 6;

  // Botanical leaves behind the portrait
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * 360 - 60;
    const rad = (angle * Math.PI) / 180;
    const lx = 595.28 / 2 + Math.cos(rad) * (portraitRadius + 9);
    const ly = portraitCenterY + Math.sin(rad) * (portraitRadius + 9);
    drawLeaf(ctx, pt(lx), pt(ly), pt(0.9), angle, ACCENT, 0.14);
  }

  const featureSize = 9.5;
  const featureAdvance = featureSize * 1.55;
  for (let r = 0; r < 3; r++) {
    const rowY = top + 4 + r * featureAdvance;
    for (const [items, anchor] of [[leftFeatures, MARGIN + sideWidth / 2], [rightFeatures, 595.28 - MARGIN - sideWidth / 2]] as const) {
      const item = items[r];
      ctx.font = `bold ${pt(featureSize)}px ${SANS}`;
      const bulletWidth = ctx.measureText('\u2022').width;
      ctx.font = `normal ${pt(featureSize)}px ${SANS}`;
      const textWidth = ctx.measureText(item).width;
      const total = bulletWidth + pt(5) + textWidth;
      const baseline = pt(rowY);
      ctx.font = `bold ${pt(featureSize)}px ${SANS}`;
      ctx.fillStyle = ACCENT;
      ctx.fillText('\u2022', pt(anchor) - total / 2 + bulletWidth / 2, baseline);
      ctx.fillStyle = INK;
      ctx.fillText(item, pt(anchor) - total / 2 + bulletWidth + pt(5) + textWidth / 2, baseline);
    }
  }

  // Circular portrait (photo or placeholder) + green ring
  const portrait = options.portraitUrl ? await loadImage(photoUrl(options.portraitUrl), true) : null;
  if (portrait) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, pt(portraitCenterY), pt(portraitRadius), 0, Math.PI * 2);
    ctx.clip();
    const d = pt(portraitDiameter);
    const imgScale = Math.max(d / portrait.width, d / portrait.height);
    const sw = d / imgScale;
    const sh = d / imgScale;
    ctx.drawImage(portrait, (portrait.width - sw) / 2, (portrait.height - sh) / 2, sw, sh, W / 2 - d / 2, pt(portraitCenterY) - d / 2, d, d);
    ctx.restore();
  } else {
    ctx.fillStyle = '#f7f7f8';
    ctx.beginPath();
    ctx.arc(W / 2, pt(portraitCenterY), pt(portraitRadius), 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `bold ${pt(9)}px ${SANS}`;
    ctx.fillStyle = MUTED;
    ctx.fillText('Photo', W / 2, pt(portraitCenterY + 2));
    ctx.fillText('Coming Soon', W / 2, pt(portraitCenterY + 9));
  }
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = pt(2.2);
  ctx.beginPath();
  ctx.arc(W / 2, pt(portraitCenterY), pt(portraitRadius), 0, Math.PI * 2);
  ctx.stroke();
  top += portraitDiameter + 12;

  // ── Section 4: Memorial details ───────────────────────────────────────────
  if (options.includeEventInfo && options.deceasedName) {
    const label = 'IN LOVING MEMORY OF';
    ctx.font = `bold ${pt(7.5)}px ${SANS}`;
    ctx.fillStyle = ACCENT;
    ctx.fillText(label, W / 2, pt(top));
    top += 11;

    const decSize = fitSize(ctx, options.deceasedName, pt(24), SERIF, 'bold', pt(contentWidthPt)) / S;
    top = drawText(options.deceasedName, top, decSize, SERIF, 'bold', INK);
    top += 4;

    const details: Array<{ icon: keyof typeof SVG_ICONS; text?: string | null }> = [];
    if (options.eventVenue) details.push({ icon: 'pin', text: options.eventVenue });
    if (options.eventDateLabel) details.push({ icon: 'calendar', text: options.eventDateLabel });
    if (options.eventTime) details.push({ icon: 'clock', text: options.eventTime });
    const present = details.filter((d) => d.text);

    if (present.length > 0) {
      const dSize = 9.5;
      const cellWidth = contentWidthPt / present.length;
      const cellCenters = present.map((_, i) => MARGIN + cellWidth * i + cellWidth / 2);
      const rowY = top + dSize * 0.6;

      for (let i = 0; i < present.length; i++) {
        const text = present[i].text as string;
        const iconSize = 10.5;
        const iconScale = pt(iconSize) / 24;
        ctx.font = `normal ${pt(dSize)}px ${SANS}`;
        const textWidth = ctx.measureText(text).width;
        const total = pt(iconSize + 4) + textWidth;
        const x = pt(cellCenters[i]) - total / 2;
        drawSvgPath(ctx, SVG_ICONS[present[i].icon], x, pt(rowY + dSize * 0.15), iconScale, {
          stroke: MUTED,
          lineWidth: pt(1.4),
        });
        ctx.fillStyle = MUTED;
        ctx.fillText(text, x + pt(iconSize + 4) + textWidth / 2, pt(rowY));

        if (i < present.length - 1) {
          const dividerX = pt(cellCenters[i] + cellWidth / 2);
          ctx.strokeStyle = BORDER;
          ctx.lineWidth = pt(0.8);
          ctx.beginPath();
          ctx.moveTo(dividerX, pt(rowY - 2));
          ctx.lineTo(dividerX, pt(rowY + dSize + 2));
          ctx.stroke();
        }
      }
      top += dSize * 1.5 + 4;
    }

    top = drawText('Share this memorial with family and friends.', top, 8.5, SANS, 'normal', MUTED);
    top += 8;
  }

  // ── Section 5: QR code (vector, focal point) ──────────────────────────────
  const footerReserve = 96;
  const targetQr = 318;
  const qrSize = Math.min(targetQr, Math.max(240, H / S - top - footerReserve));

  const qr = QRCode.create(options.memorialUrl, { errorCorrectionLevel: 'H' });
  const qrN = qr.modules.size;
  const quiet = 4;
  const totalCells = qrN + quiet * 2;
  const cell = pt(qrSize / totalCells);
  const qrLeft = (W - pt(qrSize)) / 2;
  const qrTop = pt(top);
  ctx.fillStyle = INK;
  for (let row = 0; row < totalCells; row++) {
    for (let col = 0; col < totalCells; col++) {
      const dark = row >= quiet && col >= quiet && row < quiet + qrN && col < quiet + qrN ? qr.modules.get(row - quiet, col - quiet) : 0;
      if (dark) {
        ctx.fillRect(qrLeft + col * cell, qrTop + row * cell, cell + 0.15, cell + 0.15);
      }
    }
  }

  // Rounded green border around the QR
  const borderPad = 13;
  const borderRadius = 13;
  const bx = pt(qrLeft / S - borderPad);
  const by = top - borderPad;
  const bw = qrSize + borderPad * 2;
  const bh = qrSize + borderPad * 2;
  const r = borderRadius;
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = pt(1.2);
  ctx.beginPath();
  ctx.moveTo(pt(bx + r), pt(by));
  ctx.lineTo(pt(bx + bw - r), pt(by));
  ctx.arcTo(pt(bx + bw), pt(by), pt(bx + bw), pt(by + r), pt(r));
  ctx.lineTo(pt(bx + bw), pt(by + bh - r));
  ctx.arcTo(pt(bx + bw), pt(by + bh), pt(bx + bw - r), pt(by + bh), pt(r));
  ctx.lineTo(pt(bx + r), pt(by + bh));
  ctx.arcTo(pt(bx), pt(by + bh), pt(bx), pt(by + bh - r), pt(r));
  ctx.lineTo(pt(bx), pt(by + r));
  ctx.arcTo(pt(bx), pt(by), pt(bx + r), pt(by), pt(r));
  ctx.closePath();
  ctx.stroke();
  top += qrSize + borderPad * 2 + 10;

  // Short URL (bold)
  const shortUrl = options.memorialUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const urlSize = fitSize(ctx, shortUrl, pt(10.5), SANS, 'bold', pt(contentWidthPt)) / S;
  top = drawText(shortUrl, top, urlSize, SANS, 'bold', INK);
  top += 6;

  // ── QR instruction ────────────────────────────────────────────────────────
  const instrSize = 8.5;
  drawSvgPath(ctx, SVG_ICONS.phone, W / 2 - pt(6) - pt(11) / 2, pt(top + 2), pt(11) / 24, {
    stroke: ACCENT,
    lineWidth: pt(1.4),
  });
  top = drawText('Open your phone\u2019s camera', top, instrSize, SANS, 'normal', MUTED);
  top = drawText('and point it at the QR code.', top, instrSize, SANS, 'normal', MUTED);
  top += 10;

  // ── Section 6: Powered by MemoryConnect ───────────────────────────────────
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = pt(1);
  ctx.beginPath();
  ctx.moveTo(W / 2 - pt(45), pt(top));
  ctx.lineTo(W / 2 + pt(45), pt(top));
  ctx.stroke();
  top += 8;
  top = drawText('Powered by', top, 7, SANS, 'normal', MUTED);
  top += 2;
  const mcLogo = await loadImage(MC_LOGO_SRC);
  if (mcLogo) {
    const maxH = pt(13);
    const maxW = pt(120);
    const ratio = Math.min(maxW / mcLogo.width, maxH / mcLogo.height);
    ctx.drawImage(mcLogo, (W - mcLogo.width * ratio) / 2, pt(top), mcLogo.width * ratio, mcLogo.height * ratio);
    top += (mcLogo.height * ratio) / S + 3;
  }
  top = drawText('MemoryConnect', top, 8.5, SANS, 'normal', MUTED);
  drawText('memoryconnect.co.za', top, 8, SANS, 'normal', MUTED);

  if (top > 841.89 - 22) {
    console.warn(`QR poster layout overflow: content ends at ${top.toFixed(1)}pt of ${841.89.toFixed(1)}pt`);
  }

  return canvas;
}

export async function posterCanvasToPdfBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  const pngBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!pngBlob) throw new Error('Could not rasterize poster');
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const image = await doc.embedPng(await pngBlob.arrayBuffer());
  page.drawImage(image, { x: 0, y: 0, width: 595.28, height: 841.89 });
  const bytes = await doc.save();
  return new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
}

export function posterCanvasToBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not export poster'))), type, type === 'image/jpeg' ? quality : undefined);
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function formatEventDate(date: string, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: timezone || 'Africa/Johannesburg',
    }).format(new Date(date));
  } catch {
    return new Date(date).toISOString().split('T')[0];
  }
}

export function formatEventTime(date: string, timezone?: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: timezone || 'Africa/Johannesburg',
    }).format(new Date(date));
  } catch {
    return new Date(date).toISOString().slice(11, 16);
  }
}
