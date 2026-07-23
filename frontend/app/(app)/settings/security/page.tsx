"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Shield, Smartphone, Trash2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isAdminEmail } from "@/lib/admin";
import {
  addEmailMfa,
  addTotp,
  getMfaMethods,
  removeMfa,
  verifyTotp,
} from "@/lib/auth/api";
import { readLocalAuth, saveLocalAuth } from "@/lib/auth/local-session";
import { setAuthCookie } from "@/lib/auth/session-cookie";
import { useAuthToken } from "@/lib/auth/use-auth-token";

type Step = "list" | "add-totp";

function SecurityInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const getToken = useAuthToken();
  const tempToken = searchParams.get("tempToken");
  const setupRequired = searchParams.get("setup") === "required";

  const [methods, setMethods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("list");
  const [totpData, setTotpData] = useState<{ uri: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchMethods = useCallback(async () => {
    try {
      const token = await getToken();
      const list = await getMfaMethods({
        token: token || undefined,
        tempToken: tempToken || undefined,
      });
      setMethods(list);
    } catch {
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, tempToken]);

  useEffect(() => {
    const local = readLocalAuth();
    const email = local?.user?.email;
    setIsAdmin(isAdminEmail(email));
    if (!tempToken && email && !isAdminEmail(email)) {
      router.replace("/dashboard");
      return;
    }
    void fetchMethods();
  }, [fetchMethods, router, tempToken]);

  async function handleAddTotp() {
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const token = await getToken();
      const data = await addTotp({
        token: token || undefined,
        tempToken: tempToken || undefined,
      });
      if (!data.uri) {
        setError(data.message || "Failed to start authenticator setup");
        return;
      }
      setTotpData({ uri: data.uri, secret: data.secret || "" });
      setStep("add-totp");
      setCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyTotp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    const codeTrimmed = code.replace(/\D/g, "").slice(0, 6);
    if (codeTrimmed.length !== 6) {
      setError("Enter a 6-digit code");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const data = await verifyTotp(codeTrimmed, {
        token: token || undefined,
        tempToken: tempToken || undefined,
      });
      if ("token" in data && data.token) {
        saveLocalAuth(data.token, {
          email: data.user.email,
          name: data.user.name ?? undefined,
        });
        setAuthCookie(data.token);
        setSuccess("Authenticator added. Signed in successfully.");
        router.replace("/admin");
        return;
      }
      setSuccess("Authenticator added.");
      setStep("list");
      setTotpData(null);
      setCode("");
      void fetchMethods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(method: string) {
    if (
      !window.confirm(
        `Remove ${method === "totp" ? "authenticator" : "email"} verification? Admins must keep at least one method.`
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const token = await getToken();
      if (!token) throw new Error("Not signed in");
      await removeMfa(token, method);
      setSuccess("Removed.");
      void fetchMethods();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Security</h1>
            <p className="text-sm text-muted-foreground">
              Two-factor authentication for admin accounts
            </p>
          </div>
        </div>
        {setupRequired && tempToken && methods.length === 0 ? (
          <p className="mt-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
            MFA is required for Admin accounts. Add an authenticator app below.
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>MFA methods</CardTitle>
          <CardDescription>
            Authenticator app or email codes. Admins cannot remove their last method.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : step === "add-totp" && totpData ? (
            <form onSubmit={(e) => void handleVerifyTotp(e)} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Scan the QR code with Google Authenticator, Authy, or a similar app.
              </p>
              <div className="flex justify-center rounded-lg bg-muted/30 p-4">
                <QRCodeSVG value={totpData.uri} size={200} level="M" />
              </div>
              {totpData.secret ? (
                <p className="text-center text-xs text-muted-foreground break-all">
                  Manual key: <code className="font-mono">{totpData.secret}</code>
                </p>
              ) : null}
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full rounded-lg border border-border bg-background px-4 py-3 font-mono text-lg tracking-widest text-foreground"
                maxLength={6}
                required
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setStep("list");
                    setTotpData(null);
                    setCode("");
                    setError("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || code.length < 6}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Verify and complete
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-lg font-semibold text-foreground">Current methods</h2>
                {methods.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No MFA methods configured.</p>
                ) : (
                  <ul className="space-y-2">
                    {methods.includes("totp") ? (
                      <li className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                        <span className="flex items-center gap-2 text-foreground">
                          <Smartphone className="h-4 w-4" /> Authenticator app
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={submitting || Boolean(tempToken)}
                          onClick={() => void handleRemove("totp")}
                          aria-label="Remove authenticator"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ) : null}
                    {methods.includes("email") ? (
                      <li className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                        <span className="flex items-center gap-2 text-foreground">
                          <Mail className="h-4 w-4" /> Email code
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={submitting || Boolean(tempToken)}
                          onClick={() => void handleRemove("email")}
                          aria-label="Remove email MFA"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </li>
                    ) : null}
                  </ul>
                )}
              </div>

              <div>
                <h2 className="mb-3 text-lg font-semibold text-foreground">Add method</h2>
                <div className="flex flex-col gap-2">
                  {!methods.includes("totp") ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 justify-start gap-3"
                      disabled={submitting}
                      onClick={() => void handleAddTotp()}
                    >
                      <Smartphone className="h-5 w-5" />
                      Add authenticator app
                    </Button>
                  ) : null}
                  {!methods.includes("email") && !tempToken && isAdmin ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 justify-start gap-3"
                      disabled={submitting}
                      onClick={() => {
                        void (async () => {
                          setSubmitting(true);
                          setError("");
                          setSuccess("");
                          try {
                            const token = await getToken();
                            if (!token) throw new Error("Not signed in");
                            await addEmailMfa(token);
                            setSuccess("Email verification added.");
                            void fetchMethods();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Failed");
                          } finally {
                            setSubmitting(false);
                          }
                        })();
                      }}
                    >
                      <Mail className="h-5 w-5" />
                      Add email code
                    </Button>
                  ) : null}
                </div>
              </div>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              {success ? <p className="text-sm text-primary">{success}</p> : null}
              {tempToken ? (
                <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
                  ← Back to sign in
                </Link>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsSecurityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SecurityInner />
    </Suspense>
  );
}
