import log from 'electron-log';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

/**
 * 日志级别
 */
export enum LogLevel {
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Verbose = 'verbose'
}

/**
 * 日志格式
 */
export enum LogFormat {
  Text = 'text',
  JSON = 'json'
}

/**
 * 日志配置
 */
export interface LoggerConfig {
  level?: LogLevel;
  format?: LogFormat;
  enableFileLogging?: boolean;
  logDirectory?: string;
  maxLogFiles?: number;
}

/**
 * 统一日志接口
 */
export class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private context?: string;

  private constructor(config: LoggerConfig = {}) {
    this.config = {
      level: process.env.NODE_ENV === 'production' ? LogLevel.Info : LogLevel.Debug,
      format: LogFormat.Text,
      enableFileLogging: true,
      maxLogFiles: 10,
      ...config
    };

    this.initialize();
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: LoggerConfig): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(config);
    }
    return Logger.instance;
  }

  /**
   * 创建带上下文的日志实例
   */
  static create(context: string, config?: LoggerConfig): Logger {
    const logger = new Logger(config);
    logger.context = context;
    return logger;
  }

  /**
   * 初始化日志系统
   */
  private initialize(): void {
    // 配置 electron-log
    if (this.config.enableFileLogging) {
      const logDir = this.config.logDirectory ?? path.join(app.getPath('userData'), 'logs');
      fs.mkdirSync(logDir, { recursive: true });
      log.transports.file.resolvePathFn = () => path.join(logDir, 'main.log');
    }

    // 设置日志级别
    log.transports.console.level = this.config.level ?? LogLevel.Info;
    log.transports.file.level = this.config.level ?? LogLevel.Info;

    // 格式化日志
    if (this.config.format === LogFormat.JSON) {
      this.setupJsonFormatting();
    }
  }

  /**
   * 设置 JSON 格式化
   */
  private setupJsonFormatting(): void {
    const originalLog = log.log;
    log.log = (level: string, ...args: unknown[]) => {
      const message = {
        timestamp: new Date().toISOString(),
        level: level.toUpperCase(),
        context: this.context,
        message: args.map((arg) => {
          if (arg instanceof Error) {
            return {
              name: arg.name,
              message: arg.message,
              stack: arg.stack
            };
          }
          if (typeof arg === 'object') {
            return arg;
          }
          return String(arg);
        })
      };
      originalLog.call(log, level, JSON.stringify(message));
    };
  }

  /**
   * 格式化消息
   */
  private formatMessage(message: string, meta?: Record<string, unknown>): string {
    const parts = [message];
    if (this.context) {
      parts.unshift(`[${this.context}]`);
    }
    if (meta && Object.keys(meta).length > 0) {
      parts.push(JSON.stringify(meta));
    }
    return parts.join(' ');
  }

  /**
   * 错误日志
   */
  error(message: string, error?: Error | unknown, meta?: Record<string, unknown>): void {
    const formattedMessage = this.formatMessage(message, meta);
    if (error instanceof Error) {
      log.error(formattedMessage, error);
    } else if (error) {
      log.error(formattedMessage, error);
    } else {
      log.error(formattedMessage);
    }
  }

  /**
   * 警告日志
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    log.warn(this.formatMessage(message, meta));
  }

  /**
   * 信息日志
   */
  info(message: string, meta?: Record<string, unknown>): void {
    log.info(this.formatMessage(message, meta));
  }

  /**
   * 调试日志
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    log.debug(this.formatMessage(message, meta));
  }

  /**
   * 详细日志
   */
  verbose(message: string, meta?: Record<string, unknown>): void {
    log.verbose(this.formatMessage(message, meta));
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
    log.transports.console.level = level;
    log.transports.file.level = level;
  }

  /**
   * 获取日志级别
   */
  getLevel(): LogLevel {
    return (this.config.level ?? LogLevel.Info) as LogLevel;
  }
}

/**
 * 默认日志实例
 */
export const logger = Logger.getInstance();

/**
 * 创建带上下文的日志
 */
export function createLogger(context: string): Logger {
  return Logger.create(context);
}

