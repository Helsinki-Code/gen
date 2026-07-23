"use client";

import { useEffect, useState } from "react";
import { MessageSquare, Shield, Loader2, Unplug } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TwilioStatus {
  connected: boolean;
  from_number: string | null;
}

export default function TwilioSettingsPage() {
  const getToken = useAuthToken();
  const [status, setStatus] = useState<TwilioStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ account_sid: "", auth_token: "", from_number: "" });

  const loadStatus = async () => {
    const token = await getToken();
    if (!token) return;
    const s = await api.getTwilioStatus(token);
    setStatus(s);
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnect = async () => {
    if (!form.account_sid || !form.auth_token || !form.from_number) {
      setError("All fields are required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const token = await getToken();
      if (!token) return;
      await api.connectTwilio(token, form);
      setForm({ account_sid: "", auth_token: "", from_number: "" });
      await loadStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to connect Twilio");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    const token = await getToken();
    if (!token) return;
    await api.disconnectTwilio(token);
    await loadStatus();
  };

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">SMS (Twilio)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          SMS is a built-in AmroGen channel. Connect Twilio when you want SMS steps to send;
          leave it disconnected and SMS steps are skipped — email still works.
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
                <MessageSquare size={20} className="text-accent" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Connected
                  <Badge variant="success">Active</Badge>
                </CardTitle>
                <CardDescription>Sending from {status.from_number}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" size="sm" onClick={handleDisconnect}>
              <Unplug size={14} />
              Disconnect Twilio
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card elevated>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center">
                <MessageSquare size={20} className="text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Not connected</CardTitle>
                <CardDescription>
                  Enter your Twilio credentials to enable SMS sending.
                  You can connect now or later — the SMS channel stays in the product either way.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="account-sid">Account SID</Label>
              <Input
                id="account-sid"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={form.account_sid}
                onChange={(e) => setForm((f) => ({ ...f, account_sid: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="auth-token">Auth Token</Label>
              <Input
                id="auth-token"
                type="password"
                placeholder="Your Twilio auth token"
                value={form.auth_token}
                onChange={(e) => setForm((f) => ({ ...f, auth_token: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="from-number">From (Twilio number or Alpha Sender ID)</Label>
              <Input
                id="from-number"
                placeholder="+447700900123 or AmroGen"
                value={form.from_number}
                onChange={(e) => setForm((f) => ({ ...f, from_number: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                E.164 number (+country…) purchased in Twilio, or an approved alphanumeric
                sender ID (e.g. AmroGen). Coverage depends on Twilio/country rules — not every
                country accepts alpha IDs (US/Canada do not).
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
                  <MessageSquare size={16} />
                  Connect Twilio
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
                Your Twilio Account SID and Auth Token are encrypted with AES-256 before storage.
                SMS steps only send after you explicitly approve sequences. You can disconnect at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
