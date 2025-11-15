import { useState, useEffect } from 'react';
import { Settings, Save, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface LlmSettings {
  provider: string;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  headers?: Record<string, string>;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<LlmSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 加载设置
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await window.settingsAPI.getLlmSettings();
        setSettings(data);
        setApiKey(''); // 不显示已保存的 API Key
      } catch (error) {
        console.error('加载设置失败:', error);
        setMessage({ type: 'error', text: '加载设置失败' });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // 保存设置
  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    setMessage(null);

    try {
      await window.settingsAPI.updateLlmSettings({
        provider: settings.provider,
        model: settings.model,
        baseUrl: settings.baseUrl,
        apiKey: apiKey || undefined, // 如果为空字符串，则不更新
        headers: settings.headers,
      });

      setMessage({ type: 'success', text: '设置已保存！请重启应用以使 Python 后端使用新的 API Key。' });
      setApiKey(''); // 清空输入框
      
      // 重新加载设置以更新 hasApiKey 状态
      const updated = await window.settingsAPI.getLlmSettings();
      setSettings(updated);
    } catch (error) {
      console.error('保存设置失败:', error);
      setMessage({ type: 'error', text: '保存设置失败: ' + (error instanceof Error ? error.message : String(error)) });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 dark:text-blue-400" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <p className="text-gray-600 dark:text-gray-400">无法加载设置</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-3xl">
        {/* 页面标题 */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">设置</h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 ml-[52px]">
            配置 LLM API 和其他应用设置
          </p>
        </div>

        {/* 消息提示 */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex items-start gap-3">
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <p
                className={`text-sm ${
                  message.type === 'success'
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }`}
              >
                {message.text}
              </p>
            </div>
          </div>
        )}

        {/* 设置表单 */}
        <div className="space-y-6">
          {/* LLM 设置卡片 */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">LLM 配置</h2>

            <div className="space-y-4">
              {/* Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  提供商
                </label>
                <input
                  type="text"
                  value={settings.provider}
                  onChange={(e) => setSettings({ ...settings, provider: e.target.value })}
                  className="input-base w-full"
                  placeholder="openai"
                />
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  模型
                </label>
                <input
                  type="text"
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  className="input-base w-full"
                  placeholder="gpt-4o-mini"
                />
              </div>

              {/* Base URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={settings.baseUrl}
                  onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
                  className="input-base w-full"
                  placeholder="https://api.openai.com/v1"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  支持 OpenAI 兼容的 API 端点
                </p>
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="input-base w-full pr-10"
                    placeholder={settings.hasApiKey ? '已配置（输入新值以更新）' : '请输入 API Key'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    {showApiKey ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {settings.hasApiKey && (
                  <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                    ✓ API Key 已配置
                  </p>
                )}
                {!settings.hasApiKey && (
                  <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                    ⚠️ 未配置 API Key，LLM 功能将不可用
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  API Key 将安全存储在系统密钥库中
                </p>
              </div>
            </div>
          </div>

          {/* 保存按钮 */}
          <div className="flex justify-end gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center gap-2 px-6 py-2 font-medium shadow-lg hover:shadow-xl disabled:shadow-none"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  保存设置
                </>
              )}
            </button>
          </div>

          {/* 说明 */}
          <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">💡 提示</h3>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>保存设置后，需要重启应用以使 Python 后端使用新的配置</li>
              <li>API Key 存储在系统密钥库中，确保安全性</li>
              <li>支持 OpenAI 兼容的 API，如 DeepSeek、Moonshot 等</li>
              <li>如果使用自定义 API，请确保 Base URL 正确</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}


