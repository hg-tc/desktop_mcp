/**
 * 错误类型枚举
 */
export enum ErrorType {
  // 通用错误
  Unknown = 'UNKNOWN',
  Network = 'NETWORK',
  Timeout = 'TIMEOUT',
  Validation = 'VALIDATION',
  Permission = 'PERMISSION',

  // 后端服务错误
  BackendStartupFailed = 'BACKEND_STARTUP_FAILED',
  BackendHealthCheckFailed = 'BACKEND_HEALTH_CHECK_FAILED',
  BackendProcessExited = 'BACKEND_PROCESS_EXITED',

  // Go 后端错误
  GoBackendNotFound = 'GO_BACKEND_NOT_FOUND',
  GoBackendStartTimeout = 'GO_BACKEND_START_TIMEOUT',
  GoBackendAddressParseFailed = 'GO_BACKEND_ADDRESS_PARSE_FAILED',

  // Python 后端错误
  PythonBackendNotFound = 'PYTHON_BACKEND_NOT_FOUND',
  PythonBackendStartTimeout = 'PYTHON_BACKEND_START_TIMEOUT',
  PythonBackendConfigInvalid = 'PYTHON_BACKEND_CONFIG_INVALID',

  // LLM 错误
  LlmConfigMissing = 'LLM_CONFIG_MISSING',
  LlmApiError = 'LLM_API_ERROR',
  LlmTimeout = 'LLM_TIMEOUT',
  LlmToolCallFailed = 'LLM_TOOL_CALL_FAILED',

  // MCP 错误
  McpConnectionFailed = 'MCP_CONNECTION_FAILED',
  McpToolNotFound = 'MCP_TOOL_NOT_FOUND',
  McpToolExecutionFailed = 'MCP_TOOL_EXECUTION_FAILED',

  // 设置错误
  SettingsLoadFailed = 'SETTINGS_LOAD_FAILED',
  SettingsSaveFailed = 'SETTINGS_SAVE_FAILED',
  ApiKeyNotFound = 'API_KEY_NOT_FOUND'
}

/**
 * 错误码映射
 */
export const ErrorCodeMap: Record<ErrorType, string> = {
  [ErrorType.Unknown]: 'E0000',
  [ErrorType.Network]: 'E1000',
  [ErrorType.Timeout]: 'E1001',
  [ErrorType.Validation]: 'E1002',
  [ErrorType.Permission]: 'E1003',

  [ErrorType.BackendStartupFailed]: 'E2000',
  [ErrorType.BackendHealthCheckFailed]: 'E2001',
  [ErrorType.BackendProcessExited]: 'E2002',

  [ErrorType.GoBackendNotFound]: 'E2100',
  [ErrorType.GoBackendStartTimeout]: 'E2101',
  [ErrorType.GoBackendAddressParseFailed]: 'E2102',

  [ErrorType.PythonBackendNotFound]: 'E2200',
  [ErrorType.PythonBackendStartTimeout]: 'E2201',
  [ErrorType.PythonBackendConfigInvalid]: 'E2202',

  [ErrorType.LlmConfigMissing]: 'E3000',
  [ErrorType.LlmApiError]: 'E3001',
  [ErrorType.LlmTimeout]: 'E3002',
  [ErrorType.LlmToolCallFailed]: 'E3003',

  [ErrorType.McpConnectionFailed]: 'E4000',
  [ErrorType.McpToolNotFound]: 'E4001',
  [ErrorType.McpToolExecutionFailed]: 'E4002',

  [ErrorType.SettingsLoadFailed]: 'E5000',
  [ErrorType.SettingsSaveFailed]: 'E5001',
  [ErrorType.ApiKeyNotFound]: 'E5002'
};

/**
 * 应用错误类
 */
export class AppError extends Error {
  constructor(
    public readonly type: ErrorType,
    message: string,
    public readonly code: string = ErrorCodeMap[type],
    public readonly details?: Record<string, unknown>,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * 转换为 JSON
   */
  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      code: this.code,
      message: this.message,
      details: this.details,
      originalError: this.originalError
        ? {
            name: this.originalError.name,
            message: this.originalError.message,
            stack: this.originalError.stack
          }
        : undefined
    };
  }

  /**
   * 创建网络错误
   */
  static network(message: string, originalError?: Error): AppError {
    return new AppError(ErrorType.Network, message, ErrorCodeMap[ErrorType.Network], undefined, originalError);
  }

  /**
   * 创建超时错误
   */
  static timeout(message: string, timeout?: number): AppError {
    return new AppError(ErrorType.Timeout, message, ErrorCodeMap[ErrorType.Timeout], { timeout });
  }

  /**
   * 创建验证错误
   */
  static validation(message: string, field?: string): AppError {
    return new AppError(ErrorType.Validation, message, ErrorCodeMap[ErrorType.Validation], { field });
  }
}

