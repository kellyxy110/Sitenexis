'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface DashboardErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
  correlationId: string | null;
}

export class DashboardErrorBoundary extends Component<DashboardErrorBoundaryProps, DashboardErrorBoundaryState> {
  state: DashboardErrorBoundaryState = { hasError: false, correlationId: null };

  static getDerivedStateFromError(): DashboardErrorBoundaryState {
    return { hasError: true, correlationId: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const correlationId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `dashboard-${Date.now()}`;
    this.setState({ hasError: true, correlationId });
    console.error('[dashboard-widget-error]', {
      componentName: this.props.componentName ?? 'dashboard',
      route: typeof window !== 'undefined' ? window.location.pathname : '/dashboard',
      correlationId,
      error,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div role="alert" className="card-glass rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-5">
        <p className="text-sm font-semibold text-amber-300">This dashboard section is temporarily unavailable.</p>
        <p className="mt-1 text-xs leading-relaxed text-[#9DB5C5]">Other dashboard sections remain available. Refresh this section after the underlying data is available.</p>
        {this.state.correlationId && <p className="mt-2 text-[10px] text-[#4A6280]">Reference: {this.state.correlationId}</p>}
      </div>
    );
  }
}