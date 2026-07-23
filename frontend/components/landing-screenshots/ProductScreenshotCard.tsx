'use client';

/* eslint-disable @next/next/no-img-element -- shared across Next.js and Vite apps; plain img for portability */

import { Expand } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProductScreenshotCardProps = {
  src: string;
  alt: string;
  title: string;
  onOpen: () => void;
  onMissing?: () => void;
};

/** Static in-page preview — tap/click opens fullscreen lightbox (no inline zoom). */
export function ProductScreenshotCard({
  src,
  alt,
  title,
  onOpen,
  onMissing,
}: ProductScreenshotCardProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'group w-full overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm',
        'touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
      )}
      aria-label={`View full screen: ${title}`}
    >
      <div className="relative aspect-video max-h-[min(360px,55vh)] w-full overflow-hidden bg-muted/30">
        <img
          src={src}
          alt={alt}
          width={1200}
          height={675}
          className="h-full w-full object-contain object-center p-2 transition-transform duration-300 group-hover:scale-[1.02]"
          onError={onMissing}
          loading="lazy"
          decoding="async"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent px-3 pb-3 pt-10">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-3 py-2 text-xs font-medium text-foreground shadow-sm">
            <Expand className="h-3.5 w-3.5 text-primary" aria-hidden />
            Tap to view full screen
          </span>
        </div>
      </div>
    </button>
  );
}
