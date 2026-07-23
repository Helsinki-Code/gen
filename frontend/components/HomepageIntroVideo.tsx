"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

const VIDEO_SRC = "/assets/videos/amrogen_intro_video.mp4";

export default function HomepageIntroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6 && !video.ended) {
          void video.play().catch(() => setPlaying(false));
        } else {
          video.pause();
        }
      },
      { threshold: [0, 0.6] },
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused || video.ended) {
      if (video.ended) video.currentTime = 0;
      setEnded(false);
      void video.play();
    } else {
      video.pause();
    }
  };

  const toggleMuted = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const restart = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    setEnded(false);
    void video.play();
  };

  const enterFullscreen = () => {
    void videoRef.current?.requestFullscreen?.();
  };

  return (
    <section className="border-y border-slate-700/55 bg-[#0B1118] text-[#F7F9FB]">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16 lg:py-20">
        <div className="mb-8 grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <div className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#22D3C5]">
              AmroGen in action
            </div>
            <h2 className="mt-3 text-3xl font-semibold leading-tight sm:text-4xl">
              Watch one URL become a complete outreach campaign.
            </h2>
          </div>
          <p className="max-w-2xl text-sm leading-7 text-slate-300 lg:justify-self-end lg:text-base">
            See live company research, decision-maker discovery, personalized multichannel sequences,
            quality review, and campaign-ready output in one coordinated workflow.
          </p>
        </div>

        <div className="isolate overflow-hidden rounded-lg border border-[#22D3C5]/35 bg-black shadow-[0_28px_80px_-32px_rgba(34,211,197,0.45)]">
          <div className="relative aspect-video">
            <video
              ref={videoRef}
              src={VIDEO_SRC}
              className="h-full w-full object-cover"
              muted
              playsInline
              preload="metadata"
              aria-label="AmroGen product introduction video"
              onClick={togglePlayback}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => {
                setPlaying(false);
                setEnded(true);
              }}
            />

            {(!playing || ended) && (
              <button
                type="button"
                onClick={togglePlayback}
                className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-[#0B1118]/90 text-white shadow-2xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3C5] sm:h-20 sm:w-20"
                aria-label={ended ? "Replay AmroGen introduction" : "Play AmroGen introduction"}
                title={ended ? "Replay" : "Play"}
              >
                {ended ? <RotateCcw size={28} /> : <Play size={30} className="ml-1" fill="currentColor" />}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/10 bg-[#0B1118] px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={togglePlayback}
                className="flex h-10 w-10 items-center justify-center text-white transition-colors hover:text-[#22D3C5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3C5]"
                aria-label={playing ? "Pause video" : "Play video"}
                title={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>
              <button
                type="button"
                onClick={toggleMuted}
                className="flex h-10 w-10 items-center justify-center text-white transition-colors hover:text-[#22D3C5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3C5]"
                aria-label={muted ? "Unmute video" : "Mute video"}
                title={muted ? "Unmute" : "Mute"}
              >
                {muted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <button
                type="button"
                onClick={restart}
                className="flex h-10 w-10 items-center justify-center text-white transition-colors hover:text-[#22D3C5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3C5]"
                aria-label="Restart video"
                title="Restart"
              >
                <RotateCcw size={19} />
              </button>
            </div>

            <div className="hidden items-center gap-5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 sm:flex">
              <span>Research</span>
              <span className="text-[#22D3C5]">Review</span>
              <span>Outreach</span>
            </div>

            <button
              type="button"
              onClick={enterFullscreen}
              className="flex h-10 w-10 items-center justify-center text-white transition-colors hover:text-[#38BDF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22D3C5]"
              aria-label="View video fullscreen"
              title="Fullscreen"
            >
              <Maximize2 size={20} />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 border-t border-slate-700/70 pt-4 text-center font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 sm:text-xs">
          <span>57 sec product tour</span>
          <span>Six-agent pipeline</span>
          <span className="text-[#22D3C5]">Review before send</span>
        </div>
      </div>
    </section>
  );
}
