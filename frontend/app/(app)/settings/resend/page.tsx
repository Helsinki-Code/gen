"use client";

import { useEffect, useState } from "react";
import { Mail, Shield, Loader2, Unplug, Send } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ResendStatus {
  connected: boolean;
  from_email: string | null;
  from_name: string | null;
}

export default function ResendSettingsPage() {
  const getToken = useAuthToken();
  const [status, setStatus] = useState<ResendStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ api_key: "", from_email: "", from_name: "" });

  const loadStatus = async () => {
    const token = await getToken();
    if (!token) return;
    const s = await api.getResendStatus(token);
    setStatus(s);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = async () => {
    if (!form.api_key || !form.from_email || !form.from_name) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      await api.connectResend(token, form);
      setForm({ api_key: "", from_email: "", from_name: "" });
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect Resend");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const token = await getToken();
    if (!token) return;
    await api.disconnectResend(token);
    await loadStatus();
  };

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Resend Connection</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your Resend account so AmroGen can send outreach emails on your behalf.
          Resend is used instead of Gmail when both are connected.
        </p>
      </div>

      {!status ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" />
          Loading…
        </div>
      ) : status.connected ? (
        <Card elevated>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Send size={20} className="text-accent" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Connected
                  <Badge variant="success">Active</Badge>
                </CardTitle>
                <CardDescription>
                  {status.from_name} &lt;{status.from_email}&gt;
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              <Unplug size={14} />
              Disconnect Resend
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card elevated>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center">
                <Send size={20} className="text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Not connected</CardTitle>
                <CardDescription>Enter your Resend API key to enable email sending.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">Resend API Key</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="re_xxxxxxxxxxxxxxxxxx"
                value={form.api_key}
                onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from-name">Sender Name</Label>
              <Input
                id="from-name"
                placeholder="Alex Johnson"
                value={form.from_name}
                onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from-email">Sender Email</Label>
              <Input
                id="from-email"
                type="email"
                placeholder="alex@yourdomain.com"
                value={form.from_email}
                onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Must be from a domain verified in your Resend account.
              </p>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button onClick={handleConnect} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Mail size={16} />
                  Connect Resend
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Shield size={18} className="text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium mb-1">Privacy note</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your Resend API key is encrypted with AES-256 before storage and never exposed in
                any API response. You can disconnect at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
