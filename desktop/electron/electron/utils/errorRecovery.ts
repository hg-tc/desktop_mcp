import { AppError, ErrorType } from './errorTypes';
import { ErrorHandler } from './errorHandler';
import log from 'electron-log';

/**
 * 重试配置
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  backoffMultiplier?: number;
  retryableErrors?: ErrorType[];
}

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorType.Network,
    ErrorType.Timeout,
    ErrorType.BackendHealthCheckFailed
  ]
};

/**
 * 错误恢复工具
 */
export class ErrorRecovery {
  /**
   * 带重试的执行函数
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
  ): Promise<T> {
    const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: AppError | null = null;

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = ErrorHandler.normalizeError(error);

        // 检查是否可重试
        if (!this.isRetryable(lastError, finalConfig)) {
          throw lastError;
        }

        // 如果是最后一次尝试，抛出错误
        if (attempt === finalConfig.maxRetries) {
          throw lastError;
        }

        // 计算延迟时间
        const delay = this.calculateDelay(attempt, finalConfig);
        log.warn(
          `[ErrorRecovery] Retry attempt ${attempt + 1}/${finalConfig.maxRetries} after ${delay}ms`,
          { error: lastError.message }
        );

        await this.sleep(delay);
      }
    }

    throw lastError || new AppError(ErrorType.Unknown, 'Retry failed');
  }

  /**
   * 检查错误是否可重试
   */
  private static isRetryable(error: AppError, config: RetryConfig): boolean {
    if (!config.retryableErrors) {
      return true;
    }
    return config.retryableErrors.includes(error.type);
  }

  /**
   * 计算延迟时间（指数退避）
   */
  private static calculateDelay(attempt: number, config: RetryConfig): number {
    const multiplier = config.backoffMultiplier ?? 1;
    return config.retryDelay * Math.pow(multiplier, attempt);
  }

  /**
   * 睡眠函数
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 带超时的执行函数
   */
  static async withTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    timeoutMessage?: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(
            new AppError(
              ErrorType.Timeout,
              timeoutMessage ?? `Operation timed out after ${timeout}ms`,
              undefined,
              { timeout }
            )
          );
        }, timeout);
      })
    ]);
  }

  /**
   * 带超时和重试的执行函数
   */
  static async withTimeoutAndRetry<T>(
    fn: () => Promise<T>,
    timeout: number,
    retryConfig: Partial<RetryConfig> = {},
    timeoutMessage?: string
  ): Promise<T> {
    return this.withRetry(
      () => this.withTimeout(fn, timeout, timeoutMessage),
      retryConfig
    );
  }
}

