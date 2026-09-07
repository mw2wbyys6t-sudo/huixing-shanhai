import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 琥珀金主题色 - 更鲜艳
        amber: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // 青色辅助色 - 更鲜艳
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        // 珊瑚橙 - 新增鲜艳辅助色
        coral: {
          400: '#ff8a8a',
          500: '#ff6b6b',
          600: '#ef4444',
        },
        // 品红紫 - 新增鲜艳辅助色
        purple: {
          400: '#c084fc',
          500: '#a855f7',
          600: '#7c3aed',
        },
        // 翠绿 - 新增鲜艳辅助色
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        // 粉红 - 新增鲜艳辅助色
        pink: {
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
        },
        // 亮蓝 - 新增鲜艳辅助色
        blue: {
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
        },
        // 深色背景 - 更丰富
        dark: {
          900: '#0a0a1a',
          800: '#12122a',
          700: '#1a1a3a',
          600: '#252550',
          500: '#2d2d60',
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
        'gradient-rainbow': 'linear-gradient(135deg, #fbbf24, #ff6b6b, #a855f7, #22d3ee, #10b981)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'gradient-flow': 'gradientFlow 15s ease infinite',
        'rainbow-shift': 'rainbowShift 5s ease infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(251,191,36,0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(251,191,36,0.8)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(251,191,36,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(251,191,36,0.6)' },
        },
        gradientFlow: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        rainbowShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
