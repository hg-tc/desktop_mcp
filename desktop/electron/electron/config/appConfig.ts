import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { AppConfig, AppConfigSchema } from './schema';
import { logger } from '../utils/logger';

/**
 * 加载环境变量文件
 */
function loadEnvFile(filePath: string): Record<string, string> {
  const env: Record<string, string> = {};
  if (!fs.existsSync(filePath)) {
    return env;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          // 移除引号
          env[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
      }
    }
  } catch (error) {
    logger.warn('Failed to load env file', { filePath, error });
  }

  return env;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: AppConfig = {
  app: {
    name: 'Xiaohongshu Agent',
    version: '0.1.0',
    environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development'
  },
  window: {
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 720,
    autoHideMenuBar: true
  },
  backend: {
    go: {
      port: '0',
      browserBin: process.env.MCP_BROWSER_BIN,
      cookiesPath: path.join(app.getPath('userData'), 'cookies', 'cookies.json')
    },
    python: {
      port: 18061,
      host: '127.0.0.1'
    }
  },
  llm: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1',
    temperature: 0.3,
    timeout: 120000,
    maxRetries: 2
  },
  logging: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: 'text',
    enableFileLogging: true,
    maxLogFiles: 10
  }
};

/**
 * 配置管理器
 */
class ConfigManager {
  private config: AppConfig = DEFAULT_CONFIG;
  private configPath: string;
  private initialized = false;

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
  }

  /**
   * 初始化配置
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // 从环境变量加载配置
      this.loadFromEnv();

      // 从配置文件加载配置
      await this.loadFromFile();

      // 验证配置
      this.config = AppConfigSchema.parse(this.config);

      this.initialized = true;
      logger.info('Configuration initialized', { configPath: this.configPath });
    } catch (error) {
      logger.error('Failed to initialize configuration', error);
      // 使用默认配置
      this.config = DEFAULT_CONFIG;
      this.initialized = true;
    }
  }

  /**
   * 从环境变量加载配置
   */
  private loadFromEnv(): void {
    // 加载 .env.local 文件（如果存在）
    const envLocalPath = path.join(__dirname, '..', '..', '.env.local');
    const envLocal = loadEnvFile(envLocalPath);

    // 合并环境变量（.env.local 优先级更高）
    const env = { ...process.env, ...envLocal };

    // LLM 配置
    if (env.OPENAI_API_KEY) {
      this.config.llm.apiKey = env.OPENAI_API_KEY;
    }
    if (env.OPENAI_BASE_URL) {
      this.config.llm.baseUrl = env.OPENAI_BASE_URL;
    }
    if (env.OPENAI_MODEL) {
      this.config.llm.model = env.OPENAI_MODEL;
    }

    // 后端配置
    if (env.MCP_SERVER_PORT) {
      this.config.backend.go.port = env.MCP_SERVER_PORT;
    }
    if (env.MCP_BROWSER_BIN) {
      this.config.backend.go.browserBin = env.MCP_BROWSER_BIN;
    }
    if (env.LLM_WS_PORT) {
      this.config.backend.python.port = parseInt(env.LLM_WS_PORT, 10);
    }

    // 日志配置
    if (env.LOG_LEVEL) {
      this.config.logging.level = env.LOG_LEVEL as AppConfig['logging']['level'];
    }
  }

  /**
   * 从文件加载配置
   */
  private async loadFromFile(): Promise<void> {
    if (!fs.existsSync(this.configPath)) {
      return;
    }

    try {
      const fileContent = fs.readFileSync(this.configPath, 'utf-8');
      const fileConfig = JSON.parse(fileContent);
      this.config = { ...this.config, ...fileConfig };
    } catch (error) {
      logger.warn('Failed to load config from file', { error, configPath: this.configPath });
    }
  }

  /**
   * 保存配置到文件
   */
  async save(): Promise<void> {
    try {
      const dir = path.dirname(this.configPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
      logger.info('Configuration saved', { configPath: this.configPath });
    } catch (error) {
      logger.error('Failed to save configuration', error);
      throw error;
    }
  }

  /**
   * 获取配置
   */
  getConfig(): AppConfig {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    // 验证配置
    this.config = AppConfigSchema.parse(this.config);
  }

  /**
   * 获取特定配置项
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  /**
   * 设置特定配置项
   */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    // 验证配置
    this.config = AppConfigSchema.parse(this.config);
  }
}

/**
 * 配置管理器单例
 */
export const configManager = new ConfigManager();

