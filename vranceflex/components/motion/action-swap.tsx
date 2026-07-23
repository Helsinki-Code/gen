"use client";

// Adapted from beUI Action Swap: beui.dev/components/blocks/notification-stack
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export function ActionSwapText({
  value,
  children,
}: {
  value: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();

  return (
    <span className="relative inline-grid overflow-hidden align-bottom">
      <span className="invisible col-start-1 row-start-1">{children}</span>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={reduce ? false : { opacity: 0, y: "85%", filter: "blur(3px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={reduce ? undefined : { opacity: 0, y: "-85%", filter: "blur(3px)" }}
          transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 30, mass: 0.55 }}
          className="col-start-1 row-start-1"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function ActionSwapIcon({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  animation?: "blur" | "roll" | "cascade";
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          aria-hidden
          initial={
            reduce
              ? false
              : { opacity: 0, scale: 0.25, filter: "blur(8px)" }
          }
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={
            reduce
              ? undefined
              : { opacity: 0, scale: 0.25, filter: "blur(8px)" }
          }
          transition={
            reduce
              ? { duration: 0 }
              : { duration: 0.2, ease: "easeInOut" }
          }
          className="col-start-1 row-start-1 inline-flex items-center justify-center"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
