/**
 * URL 工具函数
 */

/**
 * 构建后端基础 URL
 */
export function buildBackendBaseURL(addr: string): string {
  // 处理 IPv6 地址格式 [::]:port 或 [::1]:port
  if (addr.startsWith('[')) {
    const match = addr.match(/^\[([^\]]+)\]:(\d+)$/);
    if (match) {
      const [, host, port] = match;
      // IPv6 地址需要保留方括号
      if (host === '::' || host === '::1' || !host) {
        return `http://127.0.0.1:${port}`;
      }
      return `http://[${host}]:${port}`;
    }
  }

  // 处理 IPv4 地址格式 host:port
  const lastColonIndex = addr.lastIndexOf(':');
  if (lastColonIndex === -1) {
    // 如果没有端口，默认使用 18060
    return `http://127.0.0.1:18060`;
  }

  const hostPart = addr.substring(0, lastColonIndex);
  const portPart = addr.substring(lastColonIndex + 1);

  let host = hostPart.trim();
  if (!host || host === '0.0.0.0' || host === '::') {
    host = '127.0.0.1';
  }

  const port = portPart.trim();
  if (!port || isNaN(Number(port))) {
    return `http://127.0.0.1:18060`;
  }

  return `http://${host}:${port}`;
}

/**
 * 验证 URL 是否有效
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 规范化 URL（移除尾部斜杠）
 */
export function normalizeUrl(url: string): string {
  return url.replace(/\/$/, '');
}

