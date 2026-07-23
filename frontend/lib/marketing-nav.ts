import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  CircleHelp,
  FileText,
  Home,
  Mail,
  Sparkles,
  Wallet,
} from "lucide-react";

export type MarketingNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const MARKETING_NAV_ITEMS: MarketingNavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/how-it-works", label: "How it works", icon: Sparkles },
  { href: "/documentation", label: "Documentation", icon: BookOpen },
  { href: "/pricing", label: "Pricing", icon: Wallet },
  { href: "/about", label: "About", icon: FileText },
  { href: "/contact", label: "Contact", icon: Mail },
  { href: "/ai-sdr-tools", label: "Research hub", icon: CircleHelp },
];
