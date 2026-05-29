import { Sidebar } from '@/components/Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  userName?: string | null | undefined;
  plan?: string | undefined;
}

export function DashboardLayout({ children, userName, plan }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen bg-midnight">
      <Sidebar userName={userName} plan={plan} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
