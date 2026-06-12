import { Sidebar } from '@/components/layout/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#0D0D1A] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto min-w-0">
        {/* pt-14 offsets the fixed mobile top bar; removed on lg+ */}
        <div className="max-w-7xl mx-auto px-4 py-5 pt-[calc(3.5rem+1.25rem)] sm:px-6 lg:pt-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
