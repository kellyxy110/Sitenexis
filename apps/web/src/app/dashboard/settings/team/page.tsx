'use client';

import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TopCommandBar } from '@/components/dashboard/TopCommandBar';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Users, UserPlus, Loader2, Crown, Edit2, Eye, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface MeData {
  id: string;
  email: string;
  plan: 'free' | 'starter' | 'pro' | 'agency' | 'enterprise';
}

interface TeamMember {
  id: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  joinedAt: string;
}

const ROLE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  admin:  Crown,
  editor: Edit2,
  viewer: Eye,
};

const ROLE_COLORS: Record<string, string> = {
  admin:  '#00C8FF',
  editor: '#0BCEBC',
  viewer: '#4A6280',
};

export default function TeamPage() {
  const router = useRouter();
  const { data: me } = useQuery<MeData>({
    queryKey: ['me'],
    queryFn: () => fetch('/api/me').then((r) => r.json() as Promise<MeData>),
    staleTime: 60_000,
  });
  const { data: members, isLoading, refetch } = useQuery<TeamMember[]>({
    queryKey: ['team-members'],
    queryFn: () =>
      fetch('/api/team').then((r) => {
        if (!r.ok) return [] as TeamMember[];
        return r.json() as Promise<TeamMember[]>;
      }),
    staleTime: 60_000,
  });

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const canInvite = me?.plan === 'agency' || me?.plan === 'enterprise';

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError(null);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (res.ok) {
        setInviteEmail('');
        void refetch();
      } else {
        const j = await res.json() as { error?: string };
        setInviteError(j.error ?? 'Failed to send invite');
      }
    } catch {
      setInviteError('Failed to send invite');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Remove this team member?')) return;
    await fetch(`/api/team/${memberId}`, { method: 'DELETE' });
    void refetch();
  };

  return (
    <DashboardLayout>
      <TopCommandBar onRunAudit={(d) => router.push(`/audit/${encodeURIComponent(d)}`)} />
      <main className="flex-1 overflow-y-auto px-6 py-8 lg:px-8">

        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan" />
            <h1 className="text-xl font-bold text-white">Team</h1>
          </div>
          <p className="text-sm text-[#4A6280]">Invite teammates and manage access roles</p>
        </div>

        {/* Current user */}
        {me && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan/10 text-xs font-bold text-cyan uppercase">
              {me.email[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-white truncate">{me.email}</div>
              <div className="text-xs text-[#4A6280]">You (Admin · {me.plan} plan)</div>
            </div>
            <span className="shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold" style={{ color: ROLE_COLORS['admin'], backgroundColor: `${ROLE_COLORS['admin']}18` }}>Admin</span>
          </div>
        )}

        {/* Invite form */}
        {canInvite ? (
          <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Invite Team Member</h2>
            <div className="flex gap-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="flex-1 rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-[#334155] outline-none focus:border-cyan/40"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                className="rounded-lg border border-white/[0.08] bg-[#0A1628] px-3 py-2.5 text-sm text-white outline-none focus:border-cyan/40"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="flex items-center gap-1.5 rounded-lg bg-cyan/10 border border-cyan/20 px-4 py-2.5 text-sm font-semibold text-cyan hover:bg-cyan/20 disabled:opacity-50 transition-colors"
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                Invite
              </button>
            </div>
            {inviteError && <p className="mt-2 text-xs text-red-400">{inviteError}</p>}
            <p className="mt-2 text-xs text-[#4A6280]">
              <strong className="text-[#7A9AB4]">Editor:</strong> can run audits and view all reports.{' '}
              <strong className="text-[#7A9AB4]">Viewer:</strong> read-only access to audit results.
            </p>
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-sm text-[#4A6280]">Team members can be invited on Agency and Enterprise plans.</p>
          </div>
        )}

        {/* Team list */}
        {isLoading && <div className="h-24 animate-pulse rounded-xl bg-white/[0.03]" />}

        {!isLoading && (members ?? []).length === 0 && canInvite && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-[#4A6280]" />
            <p className="text-sm text-[#4A6280]">No team members yet. Invite someone above.</p>
          </div>
        )}

        {(members ?? []).length > 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6">
            <h2 className="mb-4 text-sm font-semibold text-[#C8DFE8]">Team Members</h2>
            <div className="space-y-3">
              {(members ?? []).map((m) => {
                const RoleIcon = ROLE_ICONS[m.role] ?? Eye;
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-xs font-bold text-[#7A9AB4] uppercase">
                      {m.email[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{m.email}</div>
                      <div className="text-xs text-[#4A6280]">
                        Joined {new Date(m.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <span className="shrink-0 flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold capitalize"
                      style={{ color: ROLE_COLORS[m.role], backgroundColor: `${ROLE_COLORS[m.role]}18` }}>
                      <RoleIcon className="h-3 w-3" />{m.role}
                    </span>
                    <button
                      onClick={() => handleRemove(m.id)}
                      className="shrink-0 rounded p-1.5 text-[#4A6280] hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </DashboardLayout>
  );
}
