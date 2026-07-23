"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Key,
  Coins,
  Mic2,
  Plus,
  ShieldCheck,
  FileText,
  Users,
  CreditCard,
  Send,
  BookUser,
  Inbox,
  Settings,
  Clock5,
  Search,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import AccountMenu from "@/components/AccountMenu";
import Logo from "@/components/Logo";
import Scene3D from "@/components/Scene3D";
import ThemeToggle from "@/components/ThemeToggle";
import { Badge } from "@/components/ui/badge";
import { Sidebar, SidebarBody, useSidebar } from "@/components/ui/sidebar";
import { readLocalAuth } from "@/lib/auth/local-session";
import { isAdminEmail } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const mainLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/discoveries", label: "Discoveries", icon: Search },
  { href: "/contacts", label: "Contacts", icon: BookUser },
];

const settingsLinks = [
  { href: "/settings/accounts", label: "Accounts", icon: Settings },
  { href: "/settings/schedule", label: "Schedule", icon: Clock5 },
  { href: "/settings/credits", label: "Credits", icon: Coins },
  { href: "/settings/api-keys", label: "API Keys", icon: Key },
];

const adminSettingsLinks = [
  { href: "/settings/security", label: "Security", icon: ShieldCheck },
];

const adminLinks = [
  { href: "/admin", label: "Admin Dashboard", icon: ShieldCheck },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/revenue", label: "Revenue", icon: CreditCard },
  { href: "/podcast-studio", label: "Podcast Studio", icon: Mic2 },
  { href: "/admin/articles", label: "Articles", icon: FileText },
];

// NavItem must be inside the Sidebar context to use useSidebar()
function NavItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  badge?: number;
}) {
  const { open, animate } = useSidebar();
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
        active
          ? "bg-primary/15 text-primary border border-primary/20 glow-border"
          : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
        !open && "justify-center px-2"
      )}
    >
      <div className="relative shrink-0">
        <Icon size={18} strokeWidth={active ? 2 : 1.75} />
        {/* Dot badge shown only when collapsed */}
        {!open && badge != null && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        )}
      </div>

      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="flex-1 whitespace-nowrap overflow-hidden"
      >
        {label}
      </motion.span>

      {/* Full badge shown only when expanded */}
      {open && badge != null && badge > 0 && (
        <span className="relative flex items-center shrink-0">
          <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-60" />
          <Badge className="relative bg-red-500 hover:bg-red-500 text-white text-[10px] h-5 min-w-5 px-1.5 rounded-full border-0">
            {badge > 99 ? "99+" : badge}
          </Badge>
        </span>
      )}
    </Link>
  );
}

function SidebarContent({
  isAdmin,
  inboxHot,
  approvalsPending,
  pathname,
}: {
  isAdmin: boolean;
  inboxHot: number;
  approvalsPending: number;
  pathname: string;
}) {
  const { open, animate } = useSidebar();

  return (
    <div className="flex flex-col h-full">
      {/* Logo header */}
      <div
        className={cn(
          "flex items-center p-4 border-b border-border/60 mb-2 transition-all",
          open ? "justify-start" : "justify-center"
        )}
      >
        <Logo size="sm" />
      </div>

      {/* New Campaign CTA */}
      <div className="px-3 pb-3">
        <Link
          href="/campaigns/new"
          className={cn(
            "flex items-center gap-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium transition-all hover:bg-primary/90",
            open ? "px-3 py-2" : "justify-center px-2 py-2"
          )}
        >
          <Plus size={16} className="shrink-0" />
          <motion.span
            animate={{
              display: animate ? (open ? "inline-block" : "none") : "inline-block",
              opacity: animate ? (open ? 1 : 0) : 1,
            }}
            className="whitespace-nowrap"
          >
            New Campaign
          </motion.span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {isAdmin && (
          <>
            {adminLinks.map(({ href, label, icon: Icon }) => (
              <NavItem
                key={href}
                href={href}
                label={label}
                icon={Icon}
                active={pathname.startsWith(href)}
              />
            ))}
            <div className="my-2 border-t border-border/40" />
          </>
        )}

        {mainLinks.map(({ href, label, icon: Icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={Icon}
            active={
              pathname === href ||
              (href !== "/dashboard" && pathname.startsWith(href + "/"))
            }
            badge={
              href === "/campaigns" && approvalsPending > 0
                ? approvalsPending
                : undefined
            }
          />
        ))}

        <NavItem
          href="/inbox"
          label="Inbox"
          icon={Inbox}
          active={pathname === "/inbox"}
          badge={inboxHot}
        />

        <div className="my-3 border-t border-border/40" />

        {settingsLinks.map(({ href, label, icon: Icon }) => (
          <NavItem
            key={href}
            href={href}
            label={label}
            icon={Icon}
            active={pathname.startsWith(href)}
          />
        ))}

        {isAdmin &&
          adminSettingsLinks.map(({ href, label, icon: Icon }) => (
            <NavItem
              key={href}
              href={href}
              label={label}
              icon={Icon}
              active={pathname.startsWith(href)}
            />
          ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border/60 space-y-2 mt-auto">
        {open ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/45 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <ThemeToggle />
          </div>
        )}
        <AccountMenu />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [inboxHot, setInboxHot] = useState(0);
  const [approvalsPending, setApprovalsPending] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const prevApprovals = useRef(0);
  const isHeavyEditor = pathname.startsWith("/admin/articles");

  useEffect(() => {
    const email = readLocalAuth()?.user.email ?? "";
    setIsAdmin(isAdminEmail(email));
  }, []);

  useEffect(() => {
    const stored = readLocalAuth();
    if (stored?.token) setToken(stored.token);
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    const fetchCount = async () => {
      try {
        const data = await api.getInboxCount(token);
        if (cancelled) return;
        setInboxHot(data.hot ?? 0);

        const newApprovals = data.approvals ?? 0;
        setApprovalsPending(newApprovals);

        if (newApprovals > prevApprovals.current && prevApprovals.current >= 0) {
          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            new Notification("AmroGen — Action Required", {
              body: `${newApprovals} campaign${newApprovals > 1 ? "s need" : " needs"} your approval`,
              icon: "/favicon.ico",
            });
          }
        }
        prevApprovals.current = newApprovals;
      } catch {}
    };

    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  return (
    <div className="relative min-h-screen flex overflow-hidden">
      {isHeavyEditor ? (
        <div className="fixed inset-0 bg-background" aria-hidden="true" />
      ) : (
        <Scene3D intensity="subtle" className="fixed inset-0" />
      )}

      {/* Collapsible sidebar — hover to expand (desktop), hamburger overlay (mobile) */}
      <div className="relative z-20">
        <Sidebar animate={true}>
          <SidebarBody
            className={cn(
              // Override default neutral bg with glass-panel
              "!bg-transparent glass-panel border-r border-border/80",
              "m-3 mr-0 rounded-xl h-[calc(100vh-1.5rem)] shrink-0",
              "!px-0 !py-0 overflow-hidden"
            )}
          >
            <SidebarContent
              isAdmin={isAdmin}
              inboxHot={inboxHot}
              approvalsPending={approvalsPending}
              pathname={pathname}
            />
          </SidebarBody>
        </Sidebar>
      </div>

      {/* Main content */}
      <main className="relative z-10 flex-1 overflow-auto p-3 pl-0">
        <div className="min-h-[calc(100vh-1.5rem)]">{children}</div>
      </main>
    </div>
  );
}
