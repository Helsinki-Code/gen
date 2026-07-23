import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export default function Logo({ className, showText = false, size = "md" }: LogoProps) {
  const imageSize = size === "sm" ? "h-14 w-14" : size === "md" ? "h-16 w-16" : "h-20 w-20";
  const textSize = size === "sm" ? "text-sm" : size === "md" ? "text-lg" : "text-xl";

  return (
    <div className={cn("flex items-center gap-2.5", className)} aria-label="AmroGen">
      <div className={cn("relative shrink-0 overflow-hidden", imageSize)}>
        <Image
          src="/assets/images/logo/amrogen_light_logo.png"
          alt="AmroGen AI Sales Agent Platform"
          width={500}
          height={500}
          priority
          className="h-full w-full object-contain dark:hidden"
        />
        <Image
          src="/assets/images/logo/amrogen_dark_logo.png"
          alt="AmroGen AI Sales Agent Platform"
          width={500}
          height={500}
          priority
          className="hidden h-full w-full object-contain dark:block"
        />
      </div>
      {showText && (
        <span className={cn("font-semibold tracking-tight text-foreground", textSize)}>
          Amro<span className="text-primary">Gen</span>
        </span>
      )}
    </div>
  );
}
