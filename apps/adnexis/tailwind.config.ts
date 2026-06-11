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
        // AdNexis dark cinematic palette
        bg: {
          primary: '#0D0D1A',
          secondary: '#12121F',
          card: '#16162A',
          elevated: '#1C1C30',
        },
        purple: {
          DEFAULT: '#6C3EFF',
          light: '#8B5CF6',
          dim: '#3D2490',
          glow: '#6C3EFF33',
        },
        teal: {
          DEFAULT: '#00D4AA',
          dim: '#00957A',
          glow: '#00D4AA22',
        },
        orange: {
          DEFAULT: '#FF6B35',
          dim: '#CC4A1A',
          glow: '#FF6B3522',
        },
        border: {
          DEFAULT: '#2A2A4A',
          subtle: '#1E1E35',
          bright: '#3D3D6B',
        },
        text: {
          primary: '#F0F0FF',
          secondary: '#9090B8',
          muted: '#5A5A80',
        },
      },
      fontFamily: {
        sans: ['system-ui', 'Calibri', 'sans-serif'],
        display: ['Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glow-purple': 'radial-gradient(ellipse at center, #6C3EFF22 0%, transparent 70%)',
        'glow-teal': 'radial-gradient(ellipse at center, #00D4AA11 0%, transparent 70%)',
      },
      boxShadow: {
        'purple-glow': '0 0 20px #6C3EFF40',
        'teal-glow': '0 0 20px #00D4AA30',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
