import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'snow': '#f8fafc',
        'alpine': {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e3a5f',
          900: '#1e293b',
        },
        'danger': {
          1: '#4ade80',
          2: '#facc15',
          3: '#fb923c',
          4: '#ef4444',
          5: '#991b1b',
        },
      },
    },
  },
  plugins: [],
};

export default config;
