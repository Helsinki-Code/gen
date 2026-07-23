"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { readLocalAuth } from "@/lib/auth/local-session";
import { isAdminEmail } from "@/lib/admin";

interface AdminGuardProps {
  children: ReactNode;
}

export default function AdminGuard({ children }: AdminGuardProps) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const local = readLocalAuth();
    const email = local?.user.email || "";
    if (!email) {
      router.replace("/sign-in");
      return;
    }
    if (!isAdminEmail(email)) {
      router.replace("/dashboard");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-[calc(100vh-1.5rem)] items-center justify-center p-6">
        <div className="glass-panel rounded-xl px-6 py-5 text-center">
          <ShieldCheck size={24} className="mx-auto mb-3 text-primary" />
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            Checking admin access
          </div>
        </div>
      </div>
    );
  }

  return children;
}
