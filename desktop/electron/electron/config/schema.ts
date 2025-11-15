import { z } from 'zod';

/**
 * 应用配置模式
 */
export const AppConfigSchema = z.object({
  // 应用配置
  app: z.object({
    name: z.string().default('Xiaohongshu Agent'),
    version: z.string().default('0.1.0'),
    environment: z.enum(['development', 'production', 'test']).default('development')
  }),

  // 窗口配置
  window: z.object({
    width: z.number().default(1280),
    height: z.number().default(840),
    minWidth: z.number().default(1024),
    minHeight: z.number().default(720),
    autoHideMenuBar: z.boolean().default(true)
  }),

  // 后端配置
  backend: z.object({
    go: z.object({
      port: z.string().default('0'),
      browserBin: z.string().optional(),
      cookiesPath: z.string().optional()
    }),
    python: z.object({
      port: z.number().default(18061),
      host: z.string().default('127.0.0.1')
    })
  }),

  // LLM 配置
  llm: z.object({
    provider: z.string().default('openai'),
    model: z.string().default('gpt-4o-mini'),
    baseUrl: z.string().url().default('https://api.openai.com/v1'),
    apiKey: z.string().optional(),
    headers: z.record(z.string()).optional(),
    temperature: z.number().min(0).max(2).default(0.3),
    timeout: z.number().default(120000),
    maxRetries: z.number().default(2)
  }),

  // 日志配置
  logging: z.object({
    level: z.enum(['error', 'warn', 'info', 'debug', 'verbose']).default('info'),
    format: z.enum(['text', 'json']).default('text'),
    enableFileLogging: z.boolean().default(true),
    maxLogFiles: z.number().default(10)
  })
});

/**
 * 应用配置类型
 */
export type AppConfig = z.infer<typeof AppConfigSchema>;

