import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageSquare, 
  Loader2, 
  Search, 
  Brain, 
  Sparkles, 
  Zap, 
  Command,
  FileText,
  Settings,
  BarChart3
} from 'lucide-react';
import appsConfig from '../config/apps.config.json';

interface AppConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  status: string;
  version: string;
  category?: string;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  MessageSquare,
  Brain,
  Sparkles,
  Zap,
  Command,
  FileText,
  Settings,
  BarChart3,
};

export function AppSquare() {
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // 加载应用配置
    const loadApps = async () => {
      try {
        // 从配置文件加载
        const data = appsConfig;
        setApps(data.apps || []);
      } catch (error) {
        console.warn('加载应用配置失败:', error);
        setApps([]);
      } finally {
        setLoading(false);
      }
    };

    loadApps();
  }, []);

  // 过滤应用
  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && app.status === 'active';
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* 搜索栏 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-5 h-5" />
        <input
          type="text"
          placeholder="搜索应用..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-base w-full pl-10 pr-4"
        />
      </div>

      {/* 应用卡片网格 */}
      {filteredApps.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 mb-4">
            <Search className="w-8 h-8 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-lg">没有找到匹配的应用</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">尝试使用其他关键词搜索</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredApps.map((app) => {
            const Icon = iconMap[app.icon] || MessageSquare;
            return (
              <div
                key={app.id}
                className="card card-hover p-6 cursor-pointer group"
                onClick={() => navigate(app.route)}
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-200 group-hover:scale-105 transition-transform">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        app.status === 'active'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {app.status === 'active' ? '可用' : '维护中'}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {app.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {app.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                    {app.category && (
                      <span className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1 rounded-full text-xs font-medium">
                        {app.category}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      v{app.version}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

