import log from 'electron-log';
import { AppError, ErrorType } from './errorTypes';

/**
 * 错误响应格式
 */
export interface ErrorResponse {
  success: false;
  error: {
    type: ErrorType;
    code: string;
    message: string;
    details?: Record<string, unknown>;
    timestamp: number;
  };
}

/**
 * 统一错误处理
 */
export class ErrorHandler {
  /**
   * 处理错误并转换为 AppError
   */
  static normalizeError(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      // 尝试从错误消息中推断错误类型
      const message = error.message.toLowerCase();

      if (message.includes('timeout') || message.includes('timed out')) {
        return new AppError(ErrorType.Timeout, error.message, undefined, undefined, error);
      }

      if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
        return new AppError(ErrorType.Network, error.message, undefined, undefined, error);
      }

      if (message.includes('permission') || message.includes('access denied')) {
        return new AppError(ErrorType.Permission, error.message, undefined, undefined, error);
      }

      return new AppError(ErrorType.Unknown, error.message, undefined, undefined, error);
    }

    return new AppError(ErrorType.Unknown, String(error));
  }

  /**
   * 创建错误响应
   */
  static createErrorResponse(error: unknown): ErrorResponse {
    const appError = this.normalizeError(error);

    // 记录错误
    this.logError(appError);

    return {
      success: false,
      error: {
        type: appError.type,
        code: appError.code,
        message: appError.message,
        details: appError.details,
        timestamp: Date.now()
      }
    };
  }

  /**
   * 记录错误
   */
  static logError(error: AppError): void {
    const logData = {
      type: error.type,
      code: error.code,
      message: error.message,
      details: error.details,
      originalError: error.originalError
        ? {
            name: error.originalError.name,
            message: error.originalError.message
          }
        : undefined
    };

    if (error.type === ErrorType.Unknown || error.originalError) {
      log.error('[ErrorHandler]', logData, error.originalError?.stack);
    } else {
      log.warn('[ErrorHandler]', logData);
    }
  }

  /**
   * 处理并记录错误（用于 try-catch）
   */
  static handleError(error: unknown, context?: string): AppError {
    const appError = this.normalizeError(error);

    if (context) {
      appError.details = { ...appError.details, context };
    }

    this.logError(appError);
    return appError;
  }

  /**
   * 获取用户友好的错误消息
   */
  static getUserFriendlyMessage(error: unknown): string {
    const appError = this.normalizeError(error);

    // 根据错误类型返回用户友好的消息
    switch (appError.type) {
      case ErrorType.Network:
        return '网络连接失败，请检查网络设置';
      case ErrorType.Timeout:
        return '操作超时，请稍后重试';
      case ErrorType.Permission:
        return '权限不足，请检查配置';
      case ErrorType.GoBackendNotFound:
        return 'Go 后端服务未找到，请检查安装';
      case ErrorType.PythonBackendNotFound:
        return 'Python 后端服务未找到，请确保已安装 Python 3.10+';
      case ErrorType.LlmConfigMissing:
        return 'LLM 配置缺失，请在设置中配置 API Key';
      case ErrorType.McpConnectionFailed:
        return 'MCP 连接失败，请检查后端服务状态';
      default:
        return appError.message || '发生未知错误';
    }
  }
}

