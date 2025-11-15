import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media', // 自动跟随系统主题设置
  content: [
    './src/renderer/**/*.{html,ts,tsx}',
    './src/renderer/*.{html,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        // 语义化颜色变量
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding',
      },
    }
  },
  plugins: []
};

export default config;

