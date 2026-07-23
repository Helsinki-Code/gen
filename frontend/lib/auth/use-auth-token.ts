"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { readLocalAuth } from "@/lib/auth/local-session";

export function useAuthToken() {
  const router = useRouter();
  return useCallback(async () => {
    const local = readLocalAuth();
    if (local?.token && local.token.split(".").length === 3) {
      return local.token;
    }
    router.replace("/sign-in");
    return null;
  }, [router]);
}
