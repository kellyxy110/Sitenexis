import { Resend } from 'resend';
import { env } from '@/lib/env';

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY || env.RESEND_API_KEY === '') return null;
  if (!_resend) _resend = new Resend(env.RESEND_API_KEY);
  return _resend;
}

export async function sendAuditCompleteEmail({
  to,
  domain,
  auditId,
  overallScore,
  aiVisibilityScore,
}: {
  to: string;
  domain: string;
  auditId: string;
  overallScore: number | null;
  aiVisibilityScore: number | null;
}): Promise<void> {
  const resend = getResend();
  if (!resend) return; // Resend not configured — skip silently

  const appUrl = env.NEXT_PUBLIC_APP_URL;
  const reportUrl = `${appUrl}/audit/${encodeURIComponent(domain)}?auditId=${auditId}`;

  const scoreLabel = (s: number | null) => {
    if (s == null) return '—';
    if (s >= 90) return `${s} (Excellent)`;
    if (s >= 70) return `${s} (Good)`;
    if (s >= 50) return `${s} (Needs Work)`;
    return `${s} (Critical)`;
  };

  await resend.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to,
    subject: `Your SiteNexis audit for ${domain} is ready`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A1628;font-family:system-ui,-apple-system,sans-serif;color:#E2EBF0">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px">
    <!-- Logo -->
    <p style="font-size:20px;font-weight:700;color:#fff;margin:0 0 32px">
      Site<span style="color:#00C8FF">Nexis</span>
    </p>

    <!-- Heading -->
    <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 8px;line-height:1.3">
      Your audit for <span style="color:#00C8FF">${domain}</span> is ready
    </h1>
    <p style="font-size:15px;color:#6B8FA3;margin:0 0 32px;line-height:1.6">
      The 16-agent intelligence pipeline has finished. Here's a summary of your results.
    </p>

    <!-- Score cards -->
    <div style="background:#0C1E35;border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:24px;margin-bottom:24px">
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        <div>
          <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;color:#4A6280;margin:0 0 4px">Overall Score</p>
          <p style="font-size:28px;font-weight:700;color:#fff;margin:0">${overallScore ?? '—'}</p>
        </div>
        <div>
          <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.15em;color:#4A6280;margin:0 0 4px">AI Visibility</p>
          <p style="font-size:28px;font-weight:700;color:#00C8FF;margin:0">${aiVisibilityScore ?? '—'}</p>
        </div>
      </div>
      ${overallScore != null ? `<p style="font-size:13px;color:#6B8FA3;margin:16px 0 0">${scoreLabel(overallScore)}</p>` : ''}
    </div>

    <!-- CTA -->
    <a href="${reportUrl}" style="display:inline-block;background:linear-gradient(135deg,#00C8FF,#0BCEBC);color:#030907;font-size:14px;font-weight:700;padding:14px 28px;border-radius:10px;text-decoration:none;margin-bottom:32px">
      View Full Report →
    </a>

    <!-- Footer -->
    <p style="font-size:12px;color:#3A5568;margin:0;line-height:1.6">
      You're receiving this because you ran an audit on SiteNexis.<br>
      <a href="${appUrl}" style="color:#4A6280">${appUrl.replace(/^https?:\/\//, '')}</a>
    </p>
  </div>
</body>
</html>`,
  }).catch((err: unknown) => {
    // Non-fatal — never block audit completion on email failure
    console.error('[email] sendAuditCompleteEmail failed:', err instanceof Error ? err.message : String(err));
  });
}
