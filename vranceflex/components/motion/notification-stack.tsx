"use client";

// beUI Notification Stack, adapted for the VranceFlex campaign activity surface.
// Source: beui.dev/components/blocks/notification-stack
import { ArrowUpRight, BellOff } from "lucide-react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import {
  useCallback,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ActionSwapText } from "./action-swap";
import { EASE_OUT, SPRING_LAYOUT } from "../../lib/ease";
import { useHoverCapable } from "../../lib/hooks/use-hover-capable";
import { cn } from "../../lib/utils";

export type NotificationStackItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  trailing?: ReactNode;
};

export interface NotificationStackProps {
  items: NotificationStackItem[];
  maxVisible?: number;
  collapsedLabel?: string;
  expandedLabel?: string;
  className?: string;
}

const STACK_PEEK = 8;
const STACK_INSET = 12;

function CardContent({ item }: { item: NotificationStackItem }) {
  return (
    <span className="flex min-w-0 flex-col gap-1.5 py-4">
      <span className="flex min-w-0 items-start justify-between gap-3">
        <span className="min-w-0 text-sm font-semibold leading-snug">{item.title}</span>
        {item.trailing ? <span className="shrink-0 text-xs">{item.trailing}</span> : null}
      </span>
      {item.description ? (
        <span className="text-xs leading-relaxed text-muted-foreground">{item.description}</span>
      ) : null}
    </span>
  );
}

export function NotificationStack({
  items,
  maxVisible = 3,
  collapsedLabel = "Agent updates",
  expandedLabel = "Inspect activity",
  className,
}: NotificationStackProps) {
  const reduce = useReducedMotion();
  const canHover = useHoverCapable();
  const hasFocus = useRef(false);
  const [expanded, setExpanded] = useState(false);
  const visibleItems = items.slice(0, Math.max(1, maxVisible));
  const primaryItem = visibleItems[0];
  const setValue = useCallback((value: boolean) => setExpanded(value), []);

  const layoutTransition: Transition = reduce ? { duration: 0 } : SPRING_LAYOUT;
  const cardTransition: Transition = reduce
    ? { duration: 0 }
    : { duration: 0.32, ease: EASE_OUT };

  if (!primaryItem) {
    return (
      <div className={cn("flex items-center justify-center gap-2 rounded-3xl bg-muted px-5 py-8", className)}>
        <BellOff className="size-4" /> All caught up
      </div>
    );
  }

  const handleBlur = (event: FocusEvent<HTMLButtonElement>) => {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    hasFocus.current = false;
    setValue(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    setValue(false);
    event.currentTarget.blur();
  };

  return (
    <motion.button
      type="button"
      initial={false}
      aria-expanded={expanded}
      aria-label={`${items.length} agent updates. ${expanded ? "Collapse" : "Expand"} activity.`}
      onPointerEnter={() => canHover && setValue(true)}
      onPointerLeave={() => canHover && !hasFocus.current && setValue(false)}
      onFocus={() => {
        hasFocus.current = true;
      }}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={() => setValue(!expanded)}
      className={cn(
        "relative z-10 block w-full cursor-pointer rounded-3xl text-left text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      <span aria-hidden="true" className="invisible block p-3">
        <span className="block rounded-2xl border border-transparent px-4"><CardContent item={primaryItem} /></span>
        <span className="mt-2 block h-9" />
      </span>

      <span className="absolute inset-x-0 bottom-0 block p-3">
        <motion.span layout initial={false} transition={layoutTransition} className="absolute inset-0 rounded-3xl bg-muted" />
        <span className={cn("relative z-10 grid gap-1", !expanded && "pb-2")}>
          {visibleItems.map((item, index) => (
            <motion.span
              key={item.id}
              layout="position"
              initial={false}
              animate={{
                y: expanded ? 0 : index * STACK_PEEK,
                clipPath: expanded
                  ? "inset(0px 0px round 16px)"
                  : `inset(0px ${index * STACK_INSET}px round 16px)`,
              }}
              transition={cardTransition}
              className="block rounded-2xl border border-border bg-card px-4"
              style={{
                zIndex: visibleItems.length - index,
                gridColumn: 1,
                gridRow: expanded ? index + 1 : 1,
              }}
            >
              <span className={cn("block", index > 0 && !expanded && "invisible")}><CardContent item={item} /></span>
            </motion.span>
          ))}
        </span>

        <motion.span layout="position" transition={layoutTransition} className="relative z-10 mt-2 flex min-h-9 items-center gap-2 px-1">
          <span className="grid size-7 place-items-center rounded-full bg-lime-300 text-xs font-bold text-emerald-950">{items.length}</span>
          <span className="flex items-center text-sm font-semibold">
            <ActionSwapText value={expanded ? "expanded" : "collapsed"}>
              {expanded ? (
                <span className="inline-flex items-center gap-1">{expandedLabel}<ArrowUpRight className="size-4" /></span>
              ) : collapsedLabel}
            </ActionSwapText>
          </span>
        </motion.span>
      </span>
    </motion.button>
  );
}
