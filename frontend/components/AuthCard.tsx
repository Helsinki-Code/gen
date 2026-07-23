import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export default function AuthCard({ title, description, footer, children }: AuthCardProps) {
  return (
    <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6">
      {/* Logo above card */}
      <Link href="/" className="flex flex-col items-center gap-2 group">
        <div className="relative h-16 w-16">
          <Image
            src="/assets/images/logo/amrogen_dark_logo.png"
            alt="AmroGen"
            width={64}
            height={64}
            priority
            className="h-full w-full object-contain"
          />
        </div>
        <span className="text-[11px] font-bold tracking-[0.22em] uppercase text-white/60 group-hover:text-white/80 transition-colors">
          AmroGen
        </span>
      </Link>

      {/* Card */}
      <div className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.04] p-7 backdrop-blur-sm sm:p-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-[22px] font-bold tracking-tight text-white">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-[13.5px] leading-relaxed text-white/45">
              {description}
            </p>
          )}
        </div>

        {/* Form content */}
        {children}

        {/* Footer */}
        {footer && (
          <p className="mt-6 text-center text-[13px] text-white/40">
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}
