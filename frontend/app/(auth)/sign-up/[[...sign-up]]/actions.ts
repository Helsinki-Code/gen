"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isAdminEmail } from "@/lib/admin";
import { isMfaChallenge, isMfaSetupRequired, registerWithPassword } from "@/lib/auth/api";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export async function signUpWithEmail(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!name || !email || !password) {
    return { error: "Name, email, and password are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  try {
    const data = await registerWithPassword(name, email, password);
    if (isMfaSetupRequired(data)) {
      redirect(`/setup-mfa?tempToken=${encodeURIComponent(data.tempToken)}`);
    }
    if (isMfaChallenge(data)) {
      return { error: "MFA required. Please sign in to complete verification." };
    }
    const cookieStore = await cookies();
    cookieStore.set("amrogen_token", encodeURIComponent(data.token), {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unable to create your account." };
  }

  redirect(isAdminEmail(email) ? "/admin" : "/dashboard");
}
