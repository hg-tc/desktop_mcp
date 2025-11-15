/**
 * 验证工具函数
 */

/**
 * 验证字符串是否非空
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * 验证是否为有效端口号
 */
export function isValidPort(port: number | string): boolean {
  const numPort = typeof port === 'string' ? parseInt(port, 10) : port;
  return Number.isInteger(numPort) && numPort >= 1 && numPort <= 65535;
}

/**
 * 验证是否为有效 URL
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
 * 验证 API Key 格式（基本验证）
 */
export function isValidApiKey(apiKey: string): boolean {
  return isNonEmptyString(apiKey) && apiKey.length >= 10;
}

/**
 * 验证模型名称格式
 */
export function isValidModelName(model: string): boolean {
  return isNonEmptyString(model) && /^[a-zA-Z0-9._-]+$/.test(model);
}

