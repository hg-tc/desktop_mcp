import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppWebSocket } from '../hooks/useAppWebSocket';
import { MessageSquare, Send, Loader2, Bug, X, Settings } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
}

export function XiaohongshuAgentPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const debugEndRef = useRef<HTMLDivElement>(null);
  const [showDebug, setShowDebug] = useState(false);
  const { connect, sendMessage, disconnect, connectionStatus, onMessage, debugInfo, clearDebugInfo } = useAppWebSocket(
    'xiaohongshu-agent'
  );

  // 检查后端状态
  useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        if (window.backendAPI?.getStatus) {
          const status = await window.backendAPI.getStatus();
          setBackendStatus(status);
          console.log('[Backend Status]', status);
          
          // 根据后端状态更新错误信息
          if (status.python?.reason === 'no_api_key') {
            setError('Python 后端运行中，但未配置 LLM API Key。WebSocket 连接可用，但无法使用 LLM 功能。');
          } else if (status.python?.reason === 'not_created') {
            setError('Python 后端未创建');
          } else if (!status.python?.running && status.python?.exists) {
            setError('Python 后端已创建但未运行，请查看主进程日志');
          } else if (status.python?.running && status.python?.reason === 'no_api_key') {
            // 后端运行但没有 API Key，清除错误（连接应该可以建立）
            setError(null);
          }
        }
      } catch (error) {
        console.error('[Backend Status] 获取失败:', error);
      }
    };

    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 5000); // 每5秒检查一次

    return () => clearInterval(interval);
  }, []);

  // 只在组件挂载时连接一次
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    connect();
    
    // 清理函数：组件卸载时断开连接
    return () => {
      disconnect();
    };
  }, []); // 空依赖数组，只在挂载时执行一次
  
  // 订阅消息（独立的效果）
  useEffect(() => {
    const unsubscribe = onMessage((data) => {
      setIsLoading(false);
      if (data.type === 'content') {
        // 流式内容
        setCurrentAssistantMessage((prev) => prev + (data.content || ''));
      } else if (data.type === 'content_final') {
        // 最终内容
        setCurrentAssistantMessage((prev) => {
          if (prev) {
            const assistantMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: prev,
              timestamp: Date.now(),
            };
            setMessages((msg) => [...msg, assistantMessage]);
          }
          return '';
        });
      } else if (data.type === 'done') {
        // 消息完成，保存到消息列表
        setCurrentAssistantMessage((prev) => {
          if (prev) {
            const assistantMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: prev,
              timestamp: Date.now(),
            };
            setMessages((msg) => [...msg, assistantMessage]);
          }
          return '';
        });
      } else if (data.type === 'tool_call_request' || data.type === 'tool_call_result') {
        // 工具调用
        const toolMessage: Message = {
          id: Date.now().toString(),
          role: 'tool',
          content: JSON.stringify(data.result || data.arguments),
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, toolMessage]);
      } else if (data.type === 'error') {
        // 错误消息
        setError(data.error || '未知错误');
        setIsLoading(false);
        const errorMessage: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `错误: ${data.error}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      }
    });
    
    return unsubscribe;
  }, [onMessage]);
  
  // 监听连接状态变化（独立的效果）
  useEffect(() => {
    const checkConnection = setInterval(() => {
      if (connectionStatus === 'error') {
        setError('WebSocket 连接失败，请检查 Python 后端服务是否在 127.0.0.1:18061 运行');
        setIsLoading(false);
      } else if (connectionStatus === 'connected') {
        setError(null);
        setIsLoading(false);
      } else if (connectionStatus === 'connecting') {
        // 保持加载状态
        setIsLoading(true);
      }
    }, 500);
    
    return () => {
      clearInterval(checkConnection);
    };
  }, [connectionStatus]);

  useEffect(() => {
    setIsConnected(connectionStatus === 'connected');
  }, [connectionStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentAssistantMessage]);

  // 自动滚动调试面板到底部
  useEffect(() => {
    if (showDebug && debugEndRef.current) {
      debugEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [debugInfo, showDebug]);

  const handleSend = () => {
    if (!input.trim() || !isConnected) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCurrentAssistantMessage(''); // 重置当前助手消息
    
    sendMessage({
      type: 'message',
      messages: [
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: 'user',
          content: input,
        },
      ],
    });

    setInput('');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* 头部 */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 flex items-center justify-center shadow-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                小红书 Agent
              </h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                智能内容管理和发布助手
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                } animate-pulse`}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                {isConnected ? '已连接' : connectionStatus === 'connecting' ? '连接中...' : '未连接'}
              </span>
            </div>
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
              title="显示调试信息"
            >
              <Bug className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-xs text-gray-600 dark:text-gray-400">调试</span>
            </button>
          </div>
        </div>
      </div>

              {/* 调试面板 */}
              {showDebug && (
                <div className="bg-gray-900 dark:bg-gray-950 border-b border-gray-700 flex flex-col" style={{ height: '400px' }}>
                  <div className="flex items-center justify-between px-6 py-3 border-b border-gray-700 flex-shrink-0">
                    <h3 className="text-sm font-semibold text-gray-300">调试日志 ({debugInfo.length} 条)</h3>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const logText = debugInfo.join('\n');
                          navigator.clipboard.writeText(logText).then(() => {
                            alert('日志已复制到剪贴板');
                          });
                        }}
                        className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                        title="复制所有日志"
                      >
                        复制
                      </button>
                      <button
                        onClick={clearDebugInfo}
                        className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                        title="清空日志"
                      >
                        清空
                      </button>
                      <button
                        onClick={() => setShowDebug(false)}
                        className="text-gray-400 hover:text-gray-300 p-1"
                        title="关闭调试面板"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 py-3">
                    <div className="space-y-1 font-mono text-xs">
                      {debugInfo.length === 0 ? (
                        <p className="text-gray-500">暂无调试信息</p>
                      ) : (
                        debugInfo.map((info, index) => {
                          // 根据日志类型添加颜色
                          let textColor = 'text-gray-400';
                          if (info.includes('✅') || info.includes('成功')) {
                            textColor = 'text-green-400';
                          } else if (info.includes('❌') || info.includes('失败') || info.includes('错误')) {
                            textColor = 'text-red-400';
                          } else if (info.includes('⚠️') || info.includes('警告')) {
                            textColor = 'text-yellow-400';
                          } else if (info.includes('💡') || info.includes('提示')) {
                            textColor = 'text-blue-400';
                          } else if (info.includes('📨') || info.includes('收到')) {
                            textColor = 'text-cyan-400';
                          } else if (info.includes('🔄') || info.includes('重连')) {
                            textColor = 'text-purple-400';
                          }
                          
                          return (
                            <div 
                              key={index} 
                              className={`${textColor} whitespace-pre-wrap break-words hover:bg-gray-800/50 px-2 py-0.5 rounded transition-colors`}
                            >
                              {info}
                            </div>
                          );
                        })
                      )}
                    </div>
                    {/* 自动滚动锚点 */}
                    <div ref={debugEndRef} className="h-0" />
                  </div>
                </div>
              )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {isLoading && messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500 animate-spin" />
            <p>正在连接到后端服务...</p>
            <p className="text-xs mt-2 text-gray-400 dark:text-gray-500">
              ws://127.0.0.1:18061/api/apps/xiaohongshu-agent/chat
            </p>
            <p className="text-xs mt-1 text-gray-500 dark:text-gray-600">
              连接状态: {connectionStatus}
            </p>
            {!showDebug && (
              <button
                onClick={() => setShowDebug(true)}
                className="mt-3 text-xs text-blue-500 hover:text-blue-600 underline"
              >
                显示调试信息
              </button>
            )}
          </div>
        )}
        
        {/* 后端状态信息 */}
        {backendStatus && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
            <p className="text-blue-800 dark:text-blue-200 text-sm font-medium mb-2">后端服务状态</p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${backendStatus.go?.running ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-blue-700 dark:text-blue-300">
                  Go 后端: {backendStatus.go?.running ? '运行中' : backendStatus.go?.exists ? '已停止' : '未创建'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${backendStatus.python?.running ? 'bg-green-500' : 'bg-red-500'}`} />
                <span className="text-blue-700 dark:text-blue-300">
                  Python 后端: {
                    backendStatus.python?.running ? 
                      (backendStatus.python?.reason === 'no_api_key' ? '运行中（无 API Key）' : '运行中') :
                    backendStatus.python?.reason === 'no_api_key' ? '运行中（无 API Key）' :
                    backendStatus.python?.reason === 'not_created' ? '未创建' :
                    backendStatus.python?.exists ? '已停止' : '未知'
                  }
                </span>
              </div>
              {backendStatus.python?.reason === 'no_api_key' && (
                <div className="text-yellow-600 dark:text-yellow-400 mt-2 space-y-1">
                  <p className="font-medium">⚠️ Python 后端运行中，但未配置 LLM API Key</p>
                  <p className="text-xs">WebSocket 连接可用，但无法使用 LLM 功能。请在应用设置中配置 OPENAI_API_KEY</p>
                </div>
              )}
              {backendStatus.python?.reason === 'not_created' && (
                <div className="text-red-600 dark:text-red-400 mt-2 space-y-1">
                  <p className="font-medium">❌ Python 后端未创建</p>
                  <p className="text-xs">请查看 Electron 主进程控制台日志</p>
                </div>
              )}
              {backendStatus.python?.exists && !backendStatus.python?.running && backendStatus.python?.reason !== 'no_api_key' && backendStatus.python?.reason !== 'not_created' && (
                <div className="text-yellow-600 dark:text-yellow-400 mt-2 space-y-1">
                  <p className="font-medium">⚠️ Python 后端已创建但未运行</p>
                  <p className="text-xs">请查看 Electron 主进程控制台日志了解启动失败原因</p>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-800 dark:text-red-200 text-sm font-medium mb-2">连接失败</p>
            <p className="text-red-700 dark:text-red-300 text-xs">{error}</p>
            <div className="text-red-600 dark:text-red-400 text-xs mt-2 space-y-1">
              <p className="font-medium">可能的原因：</p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Python 后端服务未启动（最常见：未配置 LLM API Key）</li>
                <li>WebSocket 端点不存在或路由配置错误</li>
                <li>端口 18061 被占用或防火墙阻止</li>
                <li>后端服务启动失败（查看 Electron 主进程控制台日志）</li>
              </ul>
              <p className="font-medium mt-2">诊断步骤：</p>
              <ol className="list-decimal list-inside ml-2 space-y-1">
                <li>查看后端状态面板（上方蓝色面板）确认 Python 后端状态</li>
                <li>打开调试面板查看详细连接日志</li>
                <li>检查 Electron 主进程控制台是否有错误信息</li>
                <li>手动测试健康检查：<code className="bg-red-100 dark:bg-red-900/30 px-1 rounded">curl http://127.0.0.1:18061/health</code></li>
              </ol>
            </div>
          </div>
        )}
        
        {!isLoading && messages.length === 0 && !error && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-12">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <p>开始与小红书 Agent 对话</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} transition-all duration-300`}
          >
            <div
              className={`max-w-2xl rounded-2xl px-4 py-3 shadow-md ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                  : message.role === 'tool'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-900 dark:text-yellow-200'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
            </div>
          </div>
        ))}
        {currentAssistantMessage && (
          <div className="flex justify-start transition-all duration-300">
            <div className="max-w-2xl rounded-2xl px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md">
              <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-900 dark:text-gray-100">
                {currentAssistantMessage}
                <span className="inline-block w-2 h-4 bg-blue-500 dark:bg-blue-400 ml-1 animate-pulse" />
              </p>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入框 */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 shadow-lg">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入消息..."
            className="input-base flex-1"
            disabled={!isConnected}
          />
          <button
            onClick={handleSend}
            disabled={!isConnected || !input.trim()}
            className="btn-primary flex items-center gap-2 px-6 py-2 font-medium shadow-lg hover:shadow-xl disabled:shadow-none"
          >
            {connectionStatus === 'connecting' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

