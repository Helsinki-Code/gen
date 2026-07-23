"use client";

import { useRef, useState } from "react";
import { Pause, Play, Repeat, SkipBack, SkipForward } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatTime(seconds = 0) {
  const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = Math.floor(safeSeconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function CustomSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <motion.div
      className="relative h-1.5 w-full cursor-pointer rounded-full bg-white/20"
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        onChange(Math.min(Math.max((x / rect.width) * 100, 0), 100));
      }}
    >
      <motion.div
        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[#22D3C5] to-[#38BDF8]"
        style={{ width: `${value}%` }}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </motion.div>
  );
}

export default function PodcastAudioPlayer({
  src,
  cover,
  title,
}: {
  src: string;
  cover?: string;
  title?: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRepeat, setIsRepeat] = useState(false);
  const [audioError, setAudioError] = useState(false);

  function syncTime() {
    const audio = audioRef.current;
    if (!audio) return;
    const nextDuration = Number.isFinite(audio.duration) ? audio.duration : 0;
    const nextProgress = nextDuration ? (audio.currentTime / nextDuration) * 100 : 0;
    setDuration(nextDuration);
    setCurrentTime(audio.currentTime);
    setProgress(Number.isFinite(nextProgress) ? nextProgress : 0);
  }

  async function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setAudioError(true);
      setIsPlaying(false);
    }
  }

  function handleSeek(value: number) {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    audio.currentTime = (value / 100) * audio.duration;
    setProgress(value);
    setCurrentTime(audio.currentTime);
  }

  function skip(seconds: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.min(Math.max(audio.currentTime + seconds, 0), audio.duration || audio.currentTime + seconds);
    syncTime();
  }

  if (!src) return null;

  if (audioError) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Audio is being prepared — check back soon.
      </p>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        className="relative mx-auto flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#071019]/85 p-3 shadow-2xl shadow-primary/10 backdrop-blur-sm"
        initial={{ opacity: 0, filter: "blur(10px)", y: 8 }}
        animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <audio
          ref={audioRef}
          src={src}
          loop={isRepeat}
          preload="metadata"
          className="hidden"
          onLoadedMetadata={syncTime}
          onTimeUpdate={syncTime}
          onEnded={() => setIsPlaying(false)}
          onError={() => setAudioError(true)}
        />

        {cover && (
          <motion.div
            className="relative h-56 w-full overflow-hidden rounded-2xl border border-primary/20 bg-white/10"
            whileHover={{ scale: 1.01 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
          >
            <img src={cover} alt={title || "Podcast cover"} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </motion.div>
        )}

        {title && <h3 className="mt-3 text-center text-base font-bold leading-snug text-white">{title}</h3>}

        <div className="mt-3 space-y-1.5">
          <CustomSlider value={progress} onChange={handleSeek} />
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="mt-2 flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-2xl bg-black/25 p-2">
            <PlayerButton onClick={() => skip(-15)} label="Back 15 seconds">
              <SkipBack className="h-5 w-5" />
            </PlayerButton>
            <PlayerButton onClick={togglePlay} label={isPlaying ? "Pause" : "Play"} featured>
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </PlayerButton>
            <PlayerButton onClick={() => skip(15)} label="Forward 15 seconds">
              <SkipForward className="h-5 w-5" />
            </PlayerButton>
            <PlayerButton
              onClick={() => setIsRepeat((current) => !current)}
              label="Repeat"
              active={isRepeat}
            >
              <Repeat className="h-5 w-5" />
            </PlayerButton>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function PlayerButton({
  children,
  onClick,
  label,
  active,
  featured,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  featured?: boolean;
}) {
  return (
    <motion.div whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={cn(
          "h-9 w-9 rounded-full text-white hover:bg-white/10 hover:text-white",
          active && "bg-white/15 text-primary",
          featured && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
        )}
      >
        {children}
      </Button>
    </motion.div>
  );
}
