import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: () => ({
    fillRect: () => {},
    fillText: () => {},
    drawImage: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    measureText: () => ({ width: 0 }),
    clearRect: () => {},
    beginPath: () => {},
    arc: () => {},
    arcTo: () => {},
    moveTo: () => {},
    lineTo: () => {},
    bezierCurveTo: () => {},
    closePath: () => {},
    clip: () => {},
    fill: () => {},
    stroke: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineJoin: 'round',
    lineCap: 'round',
    font: '',
    globalAlpha: 1,
    textAlign: 'left',
    textBaseline: 'top',
  }),
  configurable: true,
});

Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
  value: () => 'data:image/png;base64,iVBORw0KGgo=',
  configurable: true,
});

// jsdom never resolves <img> loads, which hangs `loadImage` promises in the QR
// poster renderer. Mock Image so onerror fires immediately and placeholder
// (no-photo / no-logo) paths are exercised deterministically.
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  crossOrigin = '';
  width = 0;
  height = 0;
  private _src = '';
  set src(value: string) {
    this._src = value;
    setTimeout(() => this.onerror?.(), 0);
  }
  get src() {
    return this._src;
  }
}
Object.defineProperty(globalThis, 'Image', { value: MockImage, configurable: true });

afterEach(cleanup);
