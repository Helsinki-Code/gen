"use client";

import { useEffect, useState } from "react";
import { Copy, Key, Loader2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthToken } from "@/lib/auth/use-auth-token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
}

export default function ApiKeysPage() {
  const getToken = useAuthToken();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadKeys = async () => {
    const token = await getToken();
    if (!token) return;
    const result = (await api.getApiKeys(token)) as ApiKey[];
    setKeys(result);
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setLoading(true);
    const token = await getToken();
    if (!token) return;
    const result = (await api.createApiKey(token, newKeyName)) as { full_key: string };
    setCreatedKey(result.full_key);
    setNewKeyName("");
    await loadKeys();
    setLoading(false);
  };

  const handleRevoke = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    await api.revokeApiKey(token, id);
    await loadKeys();
  };

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Use these keys with our REST API or MCP server. Keys are shown once — store them securely.
        </p>
      </div>

      <Card elevated className="mb-6">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key size={18} className="text-primary" />
            Create new key
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="key-name" className="sr-only">Key name</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key name (e.g. Production)"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <Button onClick={handleCreate} disabled={loading || !newKeyName.trim()}>
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating…
                </>
              ) : (
                "Create Key"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {createdKey && (
        <Card className="mb-6 border-accent/30 bg-accent/5">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-accent mb-3">
              Key created — copy it now. You won&apos;t see the full key again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-2.5 font-mono break-all">
                {createdKey}
              </code>
              <Button
                variant="accent"
                size="sm"
                onClick={() => navigator.clipboard.writeText(createdKey)}
              >
                <Copy size={14} />
                Copy
              </Button>
            </div>
            <Button
              variant="link"
              size="sm"
              className="mt-2 text-accent"
              onClick={() => setCreatedKey(null)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      {keys.length === 0 ? (
        <p className="text-muted-foreground text-sm">No API keys yet.</p>
      ) : (
        <Card className="overflow-hidden mb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Prefix</th>
                  <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Last used</th>
                  <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Created</th>
                  <th className="px-5 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-4 font-medium">{k.name}</td>
                    <td className="px-5 py-4 font-mono text-muted-foreground text-xs">
                      {k.key_prefix}…
                    </td>
                    <td className="px-5 py-4 text-muted-foreground text-xs">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground text-xs">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevoke(k.id)}
                      >
                        <Trash2 size={14} />
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connect to our MCP Server</CardTitle>
          <CardDescription>
            Add this to your Claude Desktop or any MCP-compatible client:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-background border border-border rounded-lg p-4 text-xs overflow-x-auto font-mono text-primary/80 leading-relaxed">
{`{
  "mcpServers": {
    "amrogen": {
      "command": "npx",
      "args": ["-y", "@amrogen/mcp"],
      "env": {
        "AMRO_API_KEY": "amro_sk_..."
      }
    }
  }
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
