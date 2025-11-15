import { useState, useEffect, useRef, useCallback } from 'react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useAppWebSocket(appId: string) {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const messageHandlersRef = useRef<((data: any) => void)[]>([]);
  const MAX_DEBUG_LOGS = 1000; // 最多保留 1000 条日志

  const addDebugInfo = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    setDebugInfo((prev) => {
      const newLogs = [...prev, logMessage];
      // 如果超过最大数量，只保留最近的
      return newLogs.length > MAX_DEBUG_LOGS 
        ? newLogs.slice(-MAX_DEBUG_LOGS)
        : newLogs;
    });
  }, []);

  const connect = useCallback(async () => {
    // 如果已经连接，直接返回
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      addDebugInfo('WebSocket 已连接，跳过重复连接');
      return;
    }

    // 如果正在连接中，不要重复连接
    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      addDebugInfo('WebSocket 正在连接中，跳过重复连接');
      return;
    }
    
    // 如果存在旧的连接，先关闭
    if (wsRef.current) {
      addDebugInfo('关闭旧的 WebSocket 连接');
      try {
        wsRef.current.close();
      } catch (e) {
        // 忽略关闭错误
      }
      wsRef.current = null;
    }

    setConnectionStatus('connecting');
    addDebugInfo(`开始连接 WebSocket (尝试 ${reconnectAttempts.current + 1}/${maxReconnectAttempts + 1})`);

    // 先检查 HTTP 健康检查端点
    try {
      addDebugInfo('检查后端健康状态...');
      const healthUrl = `http://127.0.0.1:18061/health`;
      addDebugInfo(`健康检查 URL: ${healthUrl}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      try {
        const healthResponse = await fetch(healthUrl, { 
          method: 'GET',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          addDebugInfo(`✅ 后端健康检查通过: ${JSON.stringify(healthData)}`);
        } else {
          addDebugInfo(`⚠️ 后端健康检查失败: HTTP ${healthResponse.status} ${healthResponse.statusText}`);
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error) {
          if (fetchError.name === 'AbortError') {
            addDebugInfo(`⏱️ 健康检查超时（3秒）`);
            addDebugInfo(`   后端服务可能未启动或响应缓慢`);
          } else if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('NetworkError')) {
            addDebugInfo(`❌ 无法连接到后端: ${fetchError.message}`);
            addDebugInfo(`   这通常意味着：`);
            addDebugInfo(`   - Python 后端服务未启动`);
            addDebugInfo(`   - 端口 18061 被占用或防火墙阻止`);
            addDebugInfo(`   - 网络连接问题`);
          } else {
            addDebugInfo(`❌ 健康检查失败: ${fetchError.message}`);
          }
        } else {
          addDebugInfo(`❌ 健康检查失败: ${String(fetchError)}`);
        }
        addDebugInfo('💡 提示: Python 后端可能未启动或未配置 API Key');
      }
    } catch (error) {
      addDebugInfo(`❌ 健康检查异常: ${error instanceof Error ? error.message : String(error)}`);
      addDebugInfo('💡 提示: Python 后端可能未启动或未配置 API Key');
    }

    try {
      // 构建 WebSocket URL
      const wsUrl = `ws://127.0.0.1:18061/api/apps/${appId}/chat`;
      addDebugInfo(`尝试连接到: ${wsUrl}`);
      addDebugInfo(`WebSocket 状态: 准备创建连接`);
      
      const ws = new WebSocket(wsUrl);
      addDebugInfo(`WebSocket 对象已创建，当前状态: ${ws.readyState} (0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED)`);

      // 设置连接超时
      const connectTimeout = setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          addDebugInfo(`⏱️ 连接超时 (10秒)，当前状态: ${ws.readyState}`);
          ws.close();
          setConnectionStatus('error');
        }
      }, 10000); // 10秒超时

      ws.onopen = () => {
        addDebugInfo(`✅ WebSocket 连接已建立！`);
        clearTimeout(connectTimeout);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          addDebugInfo(`📨 收到消息: ${data.type || 'unknown'}`);
          // 调用所有消息处理器
          messageHandlersRef.current.forEach(handler => {
            try {
              handler(data);
            } catch (error) {
              addDebugInfo(`❌ 消息处理器错误: ${error instanceof Error ? error.message : String(error)}`);
            }
          });
        } catch (error) {
          addDebugInfo(`❌ 解析消息失败: ${error instanceof Error ? error.message : String(error)}`);
        }
      };

      ws.onerror = (error) => {
        addDebugInfo(`❌ WebSocket 连接错误`);
        // WebSocket 错误事件通常不包含详细信息，我们需要从 close 事件获取
        addDebugInfo(`错误类型: ${error.type || 'unknown'}`);
        addDebugInfo(`提示: 这通常意味着服务器未运行或端点不存在`);
        clearTimeout(connectTimeout);
        // 不立即设置为 error，等待 onclose 事件提供更多信息
      };

      ws.onclose = (event) => {
        addDebugInfo(`🔌 WebSocket 连接已关闭`);
        addDebugInfo(`关闭代码: ${event.code}, 原因: ${event.reason || '无'}, 正常关闭: ${event.wasClean}`);
        
        // 解释关闭代码
        let codeExplanation = '';
        switch (event.code) {
          case 1000:
            codeExplanation = '正常关闭';
            break;
          case 1001:
            codeExplanation = '端点离开（如服务器关闭或浏览器导航）';
            break;
          case 1002:
            codeExplanation = '协议错误';
            break;
          case 1003:
            codeExplanation = '数据类型错误';
            break;
          case 1006:
            codeExplanation = '异常关闭（连接未正常关闭，可能是服务器未运行、端点不存在或网络问题）';
            break;
          case 1011:
            codeExplanation = '服务器错误';
            break;
          case 1015:
            codeExplanation = 'TLS 握手失败';
            break;
          default:
            codeExplanation = `未知代码: ${event.code}`;
        }
        addDebugInfo(`关闭代码含义: ${codeExplanation}`);
        
        clearTimeout(connectTimeout);
        setConnectionStatus('disconnected');

        // 对于 1006 错误（异常关闭），提供更详细的诊断
        if (event.code === 1006) {
          addDebugInfo(`⚠️ 连接异常关闭，可能原因：`);
          addDebugInfo(`   1. Python 后端服务未启动（检查是否配置了 API Key）`);
          addDebugInfo(`   2. WebSocket 端点不存在（检查路由是否正确）`);
          addDebugInfo(`   3. 端口被占用或防火墙阻止`);
          addDebugInfo(`   4. 后端服务启动失败（查看主进程日志）`);
        }

        // 如果不是正常关闭，尝试重连
        if (!event.wasClean && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          addDebugInfo(`🔄 ${delay}ms 后尝试重连 (${reconnectAttempts.current}/${maxReconnectAttempts})`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= maxReconnectAttempts) {
          addDebugInfo(`❌ 达到最大重连次数，停止重连`);
          addDebugInfo(`💡 建议：检查 Python 后端是否正在运行，查看 Electron 主进程控制台日志`);
          setConnectionStatus('error');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      addDebugInfo(`❌ 创建 WebSocket 连接失败: ${error instanceof Error ? error.message : String(error)}`);
      setConnectionStatus('error');
    }
  }, [appId, addDebugInfo]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnectionStatus('disconnected');
    reconnectAttempts.current = 0;
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket 未连接，无法发送消息');
    }
  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const onMessage = useCallback((handler: (data: any) => void) => {
    messageHandlersRef.current.push(handler);
    return () => {
      const index = messageHandlersRef.current.indexOf(handler);
      if (index > -1) {
        messageHandlersRef.current.splice(index, 1);
      }
    };
  }, []);

  return {
    connect,
    disconnect,
    sendMessage,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
    onMessage,
    debugInfo,
    clearDebugInfo: () => setDebugInfo([]),
  };
}

