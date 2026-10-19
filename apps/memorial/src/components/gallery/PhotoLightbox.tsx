import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { photoUrl } from '../../lib/api';

interface LightboxImage {
  url: string;
  caption?: string;
}

interface PhotoLightboxProps {
  images: LightboxImage[];
  currentIndex: number;
  open: boolean;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return ((index % length) + length) % length;
}

export default function PhotoLightbox({
  images,
  currentIndex,
  open,
  onClose,
  onNext,
  onPrevious,
}: PhotoLightboxProps) {
  const [visible, setVisible] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchX, setTouchX] = useState<number | null>(null);
  const [pinchDist, setPinchDist] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const scrollPosRef = useRef<number>(0);

  const hasMultiple = images.length > 1;
  const safeIndex = clampIndex(currentIndex, images.length);
  const currentImage = images[safeIndex];

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleNext = useCallback(() => {
    onNext();
  }, [onNext]);

  const handlePrevious = useCallback(() => {
    onPrevious();
  }, [onPrevious]);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      scrollPosRef.current = window.scrollY;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollPosRef.current}px`;
      document.body.style.width = '100%';
      requestAnimationFrame(() => setVisible(true));
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollPosRef.current);
      setVisible(false);
      setZoomed(false);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleClose();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'ArrowRight':
          handleNext();
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleClose, handleNext, handlePrevious]);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const focusable = containerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    containerRef.current.addEventListener('keydown', trap);
    closeRef.current?.focus();
    return () => containerRef.current?.removeEventListener('keydown', trap);
  }, [open]);

  useEffect(() => {
    if (!open) {
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    }
  }, [open]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      setZoomed((prev) => !prev);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setTouchStart(e.touches[0].clientX);
      setTouchX(e.touches[0].clientX);
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      setPinchDist(Math.sqrt(dx * dx + dy * dy));
      setZoomed(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && !zoomed) {
      setTouchX(e.touches[0].clientX);
    } else if (e.touches.length === 2 && pinchDist !== null) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > pinchDist * 1.15) {
        setZoomed(true);
      } else if (dist < pinchDist * 0.85) {
        setZoomed(false);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStart !== null && touchX !== null && !zoomed) {
      const diff = touchStart - touchX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) handleNext();
        else handlePrevious();
      }
    }
    setTouchStart(null);
    setTouchX(null);
    setPinchDist(null);
  };

  if (!open && !visible) return null;

  const swipeOffset =
    !zoomed && touchStart !== null && touchX !== null ? touchX - touchStart : 0;

  const lightbox = (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute inset-0 bg-black/95 backdrop-blur-sm" />

      <button
        ref={closeRef}
        type="button"
        onClick={handleClose}
        aria-label="Close photo viewer"
        className="absolute right-4 top-4 z-20 grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25"
      >
        <X size={22} />
      </button>

      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={handlePrevious}
            aria-label="Previous photo"
            className="absolute left-2 z-20 grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 md:left-4"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next photo"
            className="absolute right-2 z-20 grid size-11 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/25 md:right-4"
          >
            <ChevronRight size={22} />
          </button>
        </>
      )}

      {currentImage && (
        <div
          className="relative z-10 flex max-h-[95vh] max-w-[95vw] items-center justify-center transition-transform duration-200"
          style={{
            transform: `scale(${zoomed ? 1.8 : 1}) translateX(${swipeOffset}px)`,
          }}
        >
          <img
            src={photoUrl(currentImage.url)}
            alt={currentImage.caption || `Photo ${safeIndex + 1} of ${images.length}`}
            className="max-h-[95vh] max-w-[95vw] select-none object-contain"
            draggable={false}
          />
        </div>
      )}

      {currentImage?.caption && (
        <p className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm text-white/90 backdrop-blur-sm">
          {currentImage.caption}
        </p>
      )}

      {hasMultiple && (
        <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-full bg-black/50 px-4 py-1.5 text-sm text-white/90 backdrop-blur-sm">
          {safeIndex + 1} of {images.length}
        </div>
      )}
    </div>
  );

  return open || visible ? createPortal(lightbox, document.body) : null;
}
