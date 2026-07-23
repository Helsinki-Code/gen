"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/ThemeProvider";

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export default function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "group inline-flex h-9 items-center rounded-lg border border-border bg-card/80 p-1 text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        compact ? "w-9 justify-center" : "w-[4.8rem] justify-between",
        className
      )}
    >
      {compact ? (
        <span
          className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm transition-all"
          aria-hidden="true"
        >
          {isDark ? <Moon size={15} strokeWidth={2} /> : <Sun size={15} strokeWidth={2} />}
        </span>
      ) : (
        <>
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-all",
              !isDark ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
            )}
            aria-hidden="true"
          >
            <Sun size={15} strokeWidth={2} />
          </span>
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-md transition-all",
              isDark ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
            )}
            aria-hidden="true"
          >
            <Moon size={15} strokeWidth={2} />
          </span>
        </>
      )}
      {compact && (
        <span className="sr-only">{isDark ? "Dark theme active" : "Light theme active"}</span>
      )}
    </button>
  );
}
