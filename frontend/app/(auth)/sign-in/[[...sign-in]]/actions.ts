"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { isAdminEmail } from "@/lib/admin";
import { isMfaChallenge, isMfaSetupRequired, loginWithPassword } from "@/lib/auth/api";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;

export async function signInWithEmail(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    const data = await loginWithPassword(email, password);
    if (isMfaSetupRequired(data)) {
      redirect(`/setup-mfa?tempToken=${encodeURIComponent(data.tempToken)}`);
    }
    if (isMfaChallenge(data)) {
      return { error: "MFA required. Please use the sign-in form to complete verification." };
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
    return { error: err instanceof Error ? err.message : "Unable to sign in. Try again." };
  }

  redirect(isAdminEmail(email) ? "/admin" : "/dashboard");
}
