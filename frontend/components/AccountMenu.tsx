"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { clearLocalAuth, readLocalAuth } from "@/lib/auth/local-session";
import { Button } from "@/components/ui/button";

export default function AccountMenu() {
  const router = useRouter();
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const local = readLocalAuth();
    if (local?.user) {
      setUser({ name: local.user.name ?? undefined, email: local.user.email ?? undefined });
    }
  }, []);

  function handleSignOut() {
    setSigningOut(true);
    clearLocalAuth();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/45 p-3">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
          <UserRound size={17} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user?.name || "AmroGen user"}</p>
          <p className="truncate text-xs text-muted-foreground">{user?.email || "Signed in"}</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        <LogOut size={14} />
        {signingOut ? "Signing out..." : "Sign out"}
      </Button>
    </div>
  );
}
