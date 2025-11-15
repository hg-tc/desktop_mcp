import { useEffect } from 'react';

/**
 * 主题提供者组件
 * 监听系统主题变化并自动应用
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // 监听系统主题变化
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
      // Tailwind 的 darkMode: 'media' 会自动处理，这里只需要确保 HTML 元素有正确的类
      // 如果需要手动控制，可以在这里添加逻辑
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };
    
    // 初始设置
    handleThemeChange(mediaQuery);
    
    // 监听变化
    mediaQuery.addEventListener('change', handleThemeChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
    };
  }, []);

  return <>{children}</>;
}


