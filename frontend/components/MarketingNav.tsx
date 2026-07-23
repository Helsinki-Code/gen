"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { SUITE_PRODUCTS } from "@/lib/brand";
import { MARKETING_NAV_ITEMS } from "@/lib/marketing-nav";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MarketingNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const navLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      active ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted",
    );

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <nav
          className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4"
          aria-label="Main navigation"
        >
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Link href="/" aria-label="AmroGen home" className="shrink-0">
              <Logo showText={false} size="md" />
            </Link>
          </div>

          <div className="hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            {MARKETING_NAV_ITEMS.filter((item) => item.href !== "/").map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground",
                  isActive(pathname, item.href) && "font-medium text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
              <Link href="/consultation#book-demo">Book demo</Link>
            </Button>
            <Link
              href="/sign-in"
              className="hidden text-sm text-muted-foreground hover:text-foreground sm:block"
            >
              Sign in
            </Link>
            <ThemeToggle />
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/sign-up">
                Start
                <ArrowRight size={14} />
              </Link>
            </Button>
            <Button asChild size="sm" className="sm:hidden">
              <Link href="/sign-up">Start</Link>
            </Button>
          </div>
        </nav>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background md:hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <Link href="/" aria-label="AmroGen home" onClick={() => setMobileOpen(false)}>
              <Logo showText={false} size="md" />
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4">
            <p className="marketing-section-label px-3 pb-2">Menu</p>
            <div className="flex flex-col gap-1">
              {MARKETING_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={navLinkClass(active)}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="my-5 border-t border-border" />

            <p className="marketing-section-label px-3 pb-2">Amro product suite</p>
            <div className="flex flex-col gap-1">
              {SUITE_PRODUCTS.map((product) => (
                <a
                  key={product.label}
                  href={product.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {product.label}
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
                </a>
              ))}
            </div>

            <div className="my-5 border-t border-border" />

            <div className="flex flex-col gap-2 px-1">
              <Button asChild className="h-11 w-full justify-center">
                <Link href="/consultation#book-demo" onClick={() => setMobileOpen(false)}>
                  Book demo
                </Link>
              </Button>
              <Button asChild variant="outline" className="h-11 w-full justify-center">
                <Link href="/sign-in" onClick={() => setMobileOpen(false)}>
                  Sign in
                </Link>
              </Button>
              <Button asChild className="h-11 w-full justify-center">
                <Link href="/sign-up" onClick={() => setMobileOpen(false)}>
                  Start your first campaign
                </Link>
              </Button>
              <Button asChild variant="secondary" className="h-11 w-full justify-center">
                <Link href="/consultation" onClick={() => setMobileOpen(false)}>
                  Book consultation
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
