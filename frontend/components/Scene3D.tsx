"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface Scene3DProps {
  className?: string;
  intensity?: "subtle" | "medium" | "strong";
}

export default function Scene3D({ className, intensity = "medium" }: Scene3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    const handleMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setMouse({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, [reducedMotion]);

  const offsetX = reducedMotion ? 0 : (mouse.x - 0.5) * 30;
  const offsetY = reducedMotion ? 0 : (mouse.y - 0.5) * 20;
  const opacity = intensity === "subtle" ? 0.4 : intensity === "medium" ? 0.6 : 0.8;

  return (
    <div
      ref={containerRef}
      className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 gradient-mesh" style={{ opacity }} />

      {/* 3D grid plane */}
      <div
        className="absolute inset-x-0 bottom-0 h-[70%] grid-3d-bg opacity-20"
        style={{
          transform: reducedMotion
            ? "perspective(800px) rotateX(60deg)"
            : `perspective(800px) rotateX(60deg) translateX(${offsetX * 0.5}px) translateY(${offsetY * 0.3}px)`,
        }}
      />

      {[
        { width: 420, height: 120, x: "8%", y: "18%", color: "hsl(var(--glow-green) / 0.1)", rotate: "-18deg" },
        { width: 360, height: 110, x: "68%", y: "14%", color: "hsl(var(--glow-blue) / 0.1)", rotate: "14deg" },
        { width: 520, height: 90, x: "40%", y: "72%", color: "hsl(var(--glow-green) / 0.06)", rotate: "-7deg" },
      ].map((beam, i) => (
        <div
          key={i}
          className="absolute rounded-lg blur-3xl"
          style={{
            width: beam.width,
            height: beam.height,
            left: beam.x,
            top: beam.y,
            background: beam.color,
            transform: reducedMotion
              ? `rotate(${beam.rotate})`
              : `translate(${offsetX * (i + 1) * 0.24}px, ${offsetY * (i + 1) * 0.16}px) rotate(${beam.rotate})`,
            transition: "transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        />
      ))}

      {/* Wireframe cube */}
      <div
        className="absolute right-[8%] top-[18%] w-32 h-32 perspective-container hidden lg:block"
        style={{
          transform: reducedMotion
            ? undefined
            : `translate(${offsetX * -0.8}px, ${offsetY * -0.5}px)`,
          transition: "transform 0.4s cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <div
          className={cn(
            "relative w-full h-full",
            !reducedMotion && "float-slower"
          )}
          style={{
            transformStyle: "preserve-3d",
            transform: "rotateX(-20deg) rotateY(35deg)",
          }}
        >
          <div
            className="absolute inset-0 border border-primary/20 rounded-lg"
            style={{ transform: "translateZ(24px)" }}
          />
          <div
            className="absolute inset-0 border border-primary/15 rounded-lg"
            style={{ transform: "translateZ(-24px)" }}
          />
          <div
            className="absolute inset-0 border border-primary/10 rounded-lg bg-primary/5"
            style={{ transform: "rotateY(90deg) translateZ(24px)" }}
          />
        </div>
      </div>
    </div>
  );
}
