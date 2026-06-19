'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Key, Copy, Trash2, Plus, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface MeData {
  plan: 'free' | 'starter' | 'pro' | 'agency' | 'enterprise';
}

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

export default function ApiKeysPage() {
  const router = useRouter();
  const { data: me } = useQuery<MeData>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/me').then((r) => r.json() as Promise<MeData>),
    staleTime: 60_000,
  });
  const { data: keys, isLoading, refetch } = useQuery<ApiKey[]>({
    queryKey: ['api-keys'],
    queryFn: () =>
      fetch('/api/keys').then((r) => {
        if (!r.ok) return [] as ApiKey[];
        return r.json() as Promise<ApiKey[]>;
      }),
    staleTime: 30_000,
  });

  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const canUseApi = me?.plan === 'agency' || me?.plan === 'enterprise';

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (res.ok) {
        const { key } = await res.json() as { key: string };
        setNewKeyValue(key);
        setNewKeyName('');
        void refetch();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return;
    await fetch(`/api/keys/${id}`, { method: 'DELETE' });
    void refetch();
  };

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <Key className="h-5 w-5 text-cyan" />
            <h1 className="text-xl font-bold text-white">API Keys</h1>
            <span className="rounded-pill border border-purple/25 bg-purple/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-purple">Agency+</span>
          </div>
          <p className="text-sm text-[#4A6280]">Programmatic access to SiteNexis audit data and intelligence APIs</p>
        </div>

        {!canUseApi && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber/20 bg-amber/[0.04] p-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" />
            <div>
              <p className="text-sm font-semibold text-amber">Agency or Enterprise plan required</p>
              <p className="mt-0.5 text-xs text-[#4A6280]">API access is available on Agency and Enterprise plans. Upgrade to generate and manage API keys.</p>
            </div>
          </div>
        )}

        {/* New key revealed */}
        {newKeyValue && (
          <div className="mb-6 rounded-xl border border-teal/20 bg-teal/[0.04] p-5">
            <p className="mb-2 text-sm font-semibold text-teal">API key created — copy it now</p>
            <p className="mb-3 text-xs text-[#4A6280]">This key will only be shown once. Store it securely.</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white/[0.04] px-3 py-2 text-xs font-mono text-white break-all">
                {showKey ? newKeyValue : '•'.repeat(Math.min(newKeyValue.length, 40))}
              </code>
              <button onClick={() => setShowKey(!showKey)} className="shrink-0 p-2 text-[#4A6280] hover:text-white">
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button onClick={() => handleCopy(newKeyValue)} className="shrink-0 rounded bg-teal/10 border border-teal/20 px-3 py-2 text-xs font-semibold text-teal hover:bg-teal/20 transition-colors">
                {copied ? 'Copied!' : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <button onClick={() => setNewKeyValue(null)} className="mt-3 text-xs text-[#4A6280] hover:text-white">
              Dismiss (I&apos;ve saved the key)
            </button>
          </div>
        )}

        {/* Create key */}
        {canUseApi && (
          <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Create API Key</h2>
            <div className="flex gap-3">
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="Key name (e.g. Production, CI/CD)"
                className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-[#334155] outline-none focus:border-cyan/40"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newKeyName.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-cyan/10 border border-cyan/20 px-4 py-2.5 text-sm font-semibold text-cyan hover:bg-cyan/20 disabled:opacity-50 transition-colors"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </button>
            </div>
          </div>
        )}

        {/* Key list */}
        {isLoading && <div className="h-20 animate-pulse rounded-xl bg-white/[0.03]" />}

        {!isLoading && (keys ?? []).length === 0 && canUseApi && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Key className="mx-auto mb-3 h-8 w-8 text-[#4A6280]" />
            <p className="text-sm text-[#4A6280]">No API keys yet. Create one above.</p>
          </div>
        )}

        {(keys ?? []).length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Active Keys</h2>
            <div className="space-y-3">
              {(keys ?? []).map((k) => (
                <div key={k.id} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white">{k.name}</div>
                    <div className="mt-0.5 text-xs text-[#4A6280]">
                      <code className="font-mono">{k.prefix}…</code>
                      {' · Created '}
                      {new Date(k.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {k.lastUsedAt && ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(k.id)}
                    className="shrink-0 rounded p-1.5 text-[#4A6280] hover:text-red-400 transition-colors"
                    title="Delete key"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
