import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── PRD navy system ──────────────────────────────────────────────
        midnight: '#07111F',
        deepspace: '#0A1628',
        'surface-dark': '#111827',
        // ── Accent palette ───────────────────────────────────────────────
        cyan:    '#00C8FF',
        teal:    '#0BCEBC',
        purple:  '#8B5CF6',
        sapphire:'#3B82F6',
        amber:   '#F59E0B',
        // ── Status ──────────────────────────────────────────────────────
        success:  '#10B981',
        warning:  '#F59E0B',
        critical: '#EF4444',
        neutral:  '#64748B',
        // ── Surface scale (navy) ─────────────────────────────────────────
        surface: {
          0: '#07111F',
          1: '#0A1628',
          2: '#111827',
          3: '#1E293B',
          4: '#334155',
        },
        // ── Legacy aliases (kept for backward compat) ────────────────────
        navy: '#0A1628',
        'text-mid': '#4A6280',
        'text-dark': '#1A2C42',
        'light-bg': '#EBF8FF',
        'card-bg': 'rgba(10,22,40,0.8)',
        'card-border': 'rgba(255,255,255,0.06)',
      },
      fontFamily: {
        sans:    ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        display: ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'system-ui', 'sans-serif'],
        ui:      ['var(--font-inter)', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-mono)', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        card:   '20px',
        button: '14px',
        pill:   '999px',
      },
      letterSpacing: {
        tighter: '-0.04em',
        tight:   '-0.02em',
        wide:    '0.06em',
        widest:  '0.12em',
        ultra:   '0.18em',
      },
      transitionDuration: { '250': '250ms' },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.45' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to:   { transform: 'translateX(-50%)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0,200,255,0)' },
          '50%':      { boxShadow: '0 0 20px 4px rgba(0,200,255,0.15)' },
        },
        orbit: {
          from: { transform: 'rotate(0deg) translateX(var(--orbit-r)) rotate(0deg)' },
          to:   { transform: 'rotate(360deg) translateX(var(--orbit-r)) rotate(-360deg)' },
        },
        'scan-line': {
          '0%':   { top: '0%', opacity: '0' },
          '10%':  { opacity: '1' },
          '90%':  { opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
        'count-up': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-in':    'fade-in 0.25s ease-out',
        'scale-in':   'scale-in 0.25s ease-out',
        'pulse-slow': 'pulse-slow 2.5s ease-in-out infinite',
        marquee:      'marquee 40s linear infinite',
        'glow-pulse': 'glow-pulse 2.5s ease-in-out infinite',
        'scan-line':  'scan-line 3s ease-in-out infinite',
        float:        'float 4s ease-in-out infinite',
      },
      backgroundImage: {
        'grid-navy':
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60'%3E%3Cpath d='M 60 0 L 0 0 0 60' fill='none' stroke='rgba(0,200,255,0.04)' stroke-width='1'/%3E%3C/svg%3E\")",
        'grid-dark':
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Cpath d='M 64 0 L 0 0 0 64' fill='none' stroke='rgba(255,255,255,0.025)' stroke-width='1'/%3E%3C/svg%3E\")",
        'gradient-cyan-blue': 'linear-gradient(135deg, #00C8FF 0%, #3B82F6 100%)',
        'gradient-teal-cyan': 'linear-gradient(135deg, #0BCEBC 0%, #00C8FF 100%)',
        'gradient-purple-blue':'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
      },
      boxShadow: {
        'glass-sm':    '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        'glass-md':    '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glass-lg':    '0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
        'cyan-glow':   '0 0 24px rgba(0,200,255,0.2)',
        'teal-glow':   '0 0 24px rgba(11,206,188,0.2)',
        'purple-glow': '0 0 24px rgba(139,92,246,0.2)',
        'card-hover':  '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
