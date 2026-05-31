import { redirect } from 'next/navigation';

export default function StatusPage() {
  redirect('/platform/health');
}
