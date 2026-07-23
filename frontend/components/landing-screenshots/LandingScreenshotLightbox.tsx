'use client';

/* eslint-disable @next/next/no-img-element -- shared across Next.js and Vite apps; plain img for portability */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { GalleryScreenshot } from './types';

const MIN_SCALE = 1;
const MAX_SCALE = 2.5;
const SCALE_STEP = 0.25;
const WHEEL_STEP = 0.15;

type LandingScreenshotLightboxProps = {
  items: GalleryScreenshot[];
  activeIndex: number | null;
  onActiveIndexChange: (index: number | null) => void;
  onImageError?: (id: string) => void;
};

function ZoomToolbar({
  scale,
  onZoomIn,
  onZoomOut,
  onReset,
  position,
  total,
}: {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  position?: string;
  total?: number;
}) {
  const atMin = scale <= MIN_SCALE + 0.001;
  const atMax = scale >= MAX_SCALE - 0.001;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        {position ? (
          <p className="text-xs text-muted-foreground tabular-nums">{position}</p>
        ) : null}
        {total && total > 1 ? (
          <p className="text-xs text-muted-foreground md:hidden">Swipe or use arrows for next screen</p>
        ) : null}
      </div>
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onZoomOut}
          disabled={atMin}
          aria-label="Zoom out"
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="min-w-[3.25rem] text-center text-xs tabular-nums text-muted-foreground">
          {Math.round(scale * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onZoomIn}
          disabled={atMax}
          aria-label="Zoom in"
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1 px-2.5 text-xs"
          onClick={onReset}
          disabled={atMin}
          aria-label="Reset zoom to 100 percent"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          Reset
        </Button>
      </div>
    </div>
  );
}

export function LandingScreenshotLightbox({
  items,
  activeIndex,
  onActiveIndexChange,
  onImageError,
}: LandingScreenshotLightboxProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const [scale, setScale] = useState(MIN_SCALE);

  const open = activeIndex !== null && activeIndex >= 0 && activeIndex < items.length;
  const item = open ? items[activeIndex] : null;

  const clampScale = useCallback(
    (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, Number(value.toFixed(2)))),
    []
  );

  const resetZoom = useCallback(() => setScale(MIN_SCALE), []);

  const close = useCallback(() => {
    resetZoom();
    onActiveIndexChange(null);
  }, [onActiveIndexChange, resetZoom]);

  const goPrev = useCallback(() => {
    if (activeIndex === null || items.length < 2) return;
    resetZoom();
    onActiveIndexChange((activeIndex - 1 + items.length) % items.length);
  }, [activeIndex, items.length, onActiveIndexChange, resetZoom]);

  const goNext = useCallback(() => {
    if (activeIndex === null || items.length < 2) return;
    resetZoom();
    onActiveIndexChange((activeIndex + 1) % items.length);
  }, [activeIndex, items.length, onActiveIndexChange, resetZoom]);

  useEffect(() => {
    if (!open) return;
    const node = viewportRef.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -WHEEL_STEP : WHEEL_STEP;
      setScale((current) => clampScale(current + delta));
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [open, activeIndex, clampScale]);

  useEffect(() => {
    if (!open) resetZoom();
  }, [open, resetZoom]);

  const onTouchStart = (event: React.TouchEvent) => {
    if (scale > MIN_SCALE) return;
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (scale > MIN_SCALE || touchStartX.current === null || items.length < 2) return;
    const endX = event.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 48) return;
    if (delta < 0) goNext();
    else goPrev();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        className={cn(
          'flex max-h-[100dvh] w-[100vw] max-w-[100vw] flex-col gap-0 overflow-hidden border-border p-0',
          'fixed inset-0 left-0 top-0 translate-x-0 translate-y-0 rounded-none',
          'sm:inset-auto sm:left-[50%] sm:top-[50%] sm:max-h-[95vh] sm:w-full sm:max-w-[min(96vw,1200px)]',
          'sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-lg'
        )}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {item ? (
          <>
            <div className="space-y-2 border-b border-border px-4 pb-3 pt-4 pr-14">
              <DialogTitle className="text-base font-semibold text-foreground sm:text-lg">
                {item.title}
              </DialogTitle>
              <ZoomToolbar
                scale={scale}
                onZoomIn={() => setScale((current) => clampScale(current + SCALE_STEP))}
                onZoomOut={() => setScale((current) => clampScale(current - SCALE_STEP))}
                onReset={resetZoom}
                position={items.length > 1 ? `${(activeIndex ?? 0) + 1} / ${items.length}` : undefined}
                total={items.length}
              />
            </div>

            <div className="relative min-h-0 flex-1">
              {items.length > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute left-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 shadow-md"
                    onClick={goPrev}
                    aria-label="Previous screenshot"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="absolute right-2 top-1/2 z-10 h-10 w-10 -translate-y-1/2 shadow-md"
                    onClick={goNext}
                    aria-label="Next screenshot"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </>
              ) : null}

              <div
                ref={viewportRef}
                className="h-full max-h-[calc(100dvh-11rem)] overflow-auto bg-muted/40 touch-pan-x touch-pan-y sm:max-h-[calc(95vh-11rem)]"
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
              >
                <div className="p-3 sm:p-4" style={{ width: `${scale * 100}%`, minWidth: '100%' }}>
                  <img
                    src={item.src}
                    alt={item.alt}
                    width={1200}
                    height={675}
                    className="h-auto w-full select-none rounded-md border border-border/50 bg-background object-contain"
                    onError={() => onImageError?.(item.id)}
                    draggable={false}
                    decoding="async"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-card px-4 py-3 sm:hidden">
              <Button type="button" variant="default" className="h-11 w-full" onClick={close}>
                Close
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
