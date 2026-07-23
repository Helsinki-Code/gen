"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Shield, Loader2, Unplug } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type GmailOAuthMessage = {
  type: "amrogen-gmail-oauth";
  ok: boolean;
  email?: string;
  error?: string;
};

function isGmailOAuthMessage(data: unknown): data is GmailOAuthMessage {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return obj.type === "amrogen-gmail-oauth" && typeof obj.ok === "boolean";
}

export default function GmailSettingsPage() {
  const getToken = useAuthToken();
  const [status, setStatus] = useState<{ connected: boolean; gmail_email: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState(false);

  const loadStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const s = await api.getGmailStatus(token);
    setStatus(s);
  }, [getToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("gmail");
    if (flag === "connected") {
      setNotice("Gmail connected");
      setNoticeError(false);
      void loadStatus();
      window.history.replaceState({}, "", "/settings/gmail");
    } else if (flag === "error") {
      setNotice("Gmail connection failed");
      setNoticeError(true);
      window.history.replaceState({}, "", "/settings/gmail");
    }
  }, [loadStatus]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isGmailOAuthMessage(event.data)) return;
      setLoading(false);
      if (event.data.ok) {
        setNotice(event.data.email ? `Gmail connected as ${event.data.email}` : "Gmail connected");
        setNoticeError(false);
        void loadStatus();
      } else {
        setNotice(event.data.error || "Gmail connection failed");
        setNoticeError(true);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [loadStatus]);

  const handleConnect = async () => {
    setLoading(true);
    setNotice(null);
    try {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      const { auth_url } = await api.getGmailAuthUrl(token);
      const popup = window.open(
        auth_url,
        "amrogen-gmail-oauth",
        "width=520,height=720,menubar=no,toolbar=no,status=no"
      );
      if (!popup) {
        window.location.href = auth_url;
        return;
      }
      const timer = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(timer);
          setLoading(false);
          void loadStatus();
        }
      }, 800);
    } catch {
      setLoading(false);
      setNotice("Could not start Gmail connection");
      setNoticeError(true);
    }
  };

  const handleDisconnect = async () => {
    const token = await getToken();
    if (!token) return;
    await api.disconnectGmail(token);
    await loadStatus();
    setNotice("Gmail disconnected");
    setNoticeError(false);
  };

  return (
    <div className="p-6 lg:p-8 max-w-lg mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Gmail Connection</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Optional fallback when Resend is not connected. Opens a Google sign-in popup.
        </p>
      </div>

      {notice && (
        <p className={`mb-4 text-sm ${noticeError ? "text-destructive" : "text-primary"}`}>{notice}</p>
      )}

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
                <Mail size={20} className="text-accent" />
              </div>
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Connected
                  <Badge variant="success">Active</Badge>
                </CardTitle>
                <CardDescription>{status.gmail_email}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" size="sm" onClick={() => void handleDisconnect()}>
              <Unplug size={14} />
              Disconnect Gmail
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card elevated>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary border border-border flex items-center justify-center">
                <Mail size={20} className="text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Not connected</CardTitle>
                <CardDescription>No Gmail account linked yet.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button onClick={() => void handleConnect()} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Waiting for Google…
                </>
              ) : (
                <>
                  <Mail size={16} />
                  Connect Gmail
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
                Your Gmail OAuth tokens are encrypted before storage.
                We never store your Gmail password. You can disconnect at any time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
