import { cookies } from "next/headers";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
};

export async function getSession(): Promise<{ data: { user: SessionUser | null } }> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("amrogen_token")?.value;
  const token = raw ? decodeURIComponent(raw) : undefined;

  if (!token) return { data: { user: null } };

  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { data: { user: null } };
    const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))) as {
      sub?: string;
      email?: string;
      exp?: number;
    };
    if (!payload.sub || !payload.email) return { data: { user: null } };
    if (payload.exp && payload.exp * 1000 < Date.now()) return { data: { user: null } };
    return {
      data: {
        user: {
          id: payload.sub,
          email: payload.email,
          name: null,
        },
      },
    };
  } catch {
    return { data: { user: null } };
  }
}

export const auth = { getSession };
