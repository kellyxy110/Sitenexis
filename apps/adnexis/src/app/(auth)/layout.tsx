export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary bg-grid flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-glow-purple opacity-30 pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-text-primary">
            Ad<span className="text-purple">Nexis</span>
          </h1>
          <p className="text-text-secondary mt-2 text-sm">AI Creative Intelligence Platform</p>
          <a
            href="https://sitenexis.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full border border-[#2A2A4A] bg-[#16162A] text-[11px] text-[#6C6C9A] hover:text-[#9090B8] hover:border-[#3A3A5A] transition-colors"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-teal-400/60 inline-block" />
            From the makers of SiteNexis
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true" className="opacity-50">
              <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}
