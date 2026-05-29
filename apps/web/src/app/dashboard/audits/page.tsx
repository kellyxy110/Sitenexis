import { redirect } from 'next/navigation';

// /dashboard/audits → the main dashboard shows the audit feed
export default function AuditsRedirect() {
  redirect('/dashboard');
}
