import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { XiaohongshuAgentPage } from '../pages/XiaohongshuAgentPage';
import { SettingsPage } from '../pages/SettingsPage';
import { useEffect } from 'react';

// 路由调试组件（仅开发环境）
function RouteDebugger() {
  const location = useLocation();
  
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Router] 当前路径:', location.pathname);
    }
  }, [location]);
  
  return null;
}

export function AppRouter() {
  return (
    <HashRouter>
      <RouteDebugger />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/apps/xiaohongshu-agent" element={<XiaohongshuAgentPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

