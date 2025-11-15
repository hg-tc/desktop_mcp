import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { EventEmitter } from 'events';
import log from 'electron-log';

interface RawSettings {
  llm: {
    provider: string;
    model: string;
    baseUrl: string;
    apiKeyAlias?: string;
    apiKeyFallback?: string;
    headers?: Record<string, string>;
  };
  browser?: {
    binPath?: string;
    headless?: boolean;
  };
}

export interface LlmSettingsView {
  provider: string;
  model: string;
  baseUrl: string;
  hasApiKey: boolean;
  headers?: Record<string, string>;
}

export interface LlmRuntimeConfig {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  headers?: Record<string, string>;
}

const DEFAULT_SETTINGS: RawSettings = {
  llm: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    baseUrl: 'https://api.openai.com/v1'
  },
  browser: {
    headless: false
  }
};

const SERVICE_NAME = 'xiaohongshu-agent';
const LLM_KEY_ALIAS = 'llm-openai';

let keytarModule: (typeof import('keytar')) | null | undefined;

async function getKeytar() {
  if (keytarModule === undefined) {
    try {
      const mod = await import('keytar');
      keytarModule = mod.default ?? (mod as unknown as typeof import('keytar'));
    } catch (error) {
      log.warn('keytar unavailable, falling back to file storage for API key');
      keytarModule = null;
    }
  }
  return keytarModule;
}

export class SettingsStore extends EventEmitter {
  private settingsPath: string;
  private data: RawSettings = structuredClone(DEFAULT_SETTINGS);
  private initialized = false;

  constructor() {
    super();
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
  }

  private async ensureLoaded() {
    if (this.initialized) {
      return;
    }
    try {
      await fsPromises.mkdir(path.dirname(this.settingsPath), { recursive: true });
      if (fs.existsSync(this.settingsPath)) {
        const raw = await fsPromises.readFile(this.settingsPath, 'utf-8');
        const parsed = JSON.parse(raw) as RawSettings;
        this.data = {
          llm: {
            ...DEFAULT_SETTINGS.llm,
            ...parsed.llm
          },
          browser: {
            ...DEFAULT_SETTINGS.browser,
            ...parsed.browser
          }
        };
      } else {
        await this.saveToDisk();
      }
    } catch (error) {
      log.error('Failed to load settings, using defaults', error);
      this.data = structuredClone(DEFAULT_SETTINGS);
    }
    this.initialized = true;
  }

  private async saveToDisk() {
    await fsPromises.writeFile(this.settingsPath, JSON.stringify(this.data, null, 2));
  }

  async getLlmSettingsView(): Promise<LlmSettingsView> {
    await this.ensureLoaded();
    return {
      provider: this.data.llm.provider,
      model: this.data.llm.model,
      baseUrl: this.data.llm.baseUrl,
      headers: this.data.llm.headers,
      hasApiKey: Boolean(this.data.llm.apiKeyAlias || this.data.llm.apiKeyFallback)
    };
  }

  async getLlmRuntimeConfig(): Promise<LlmRuntimeConfig | null> {
    await this.ensureLoaded();
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return null;
    }
    return {
      provider: this.data.llm.provider,
      model: this.data.llm.model,
      baseUrl: this.data.llm.baseUrl,
      headers: this.data.llm.headers,
      apiKey
    };
  }

  async updateLlmSettings(input: {
    provider?: string;
    model?: string;
    baseUrl?: string;
    apiKey?: string | null;
    headers?: Record<string, string>;
  }) {
    await this.ensureLoaded();

    if (input.provider) {
      this.data.llm.provider = input.provider;
    }
    if (input.model) {
      this.data.llm.model = input.model;
    }
    if (input.baseUrl) {
      this.data.llm.baseUrl = input.baseUrl;
    }
    if (input.headers !== undefined) {
      this.data.llm.headers = input.headers;
    }

    if (input.apiKey !== undefined) {
      await this.setApiKey(input.apiKey);
    }

    await this.saveToDisk();
    this.emit('updated', await this.getLlmSettingsView());
  }

  async setBrowserOptions(options: { binPath?: string; headless?: boolean }) {
    await this.ensureLoaded();
    this.data.browser = {
      ...this.data.browser,
      ...options
    };
    await this.saveToDisk();
    this.emit('browser-updated', this.data.browser);
  }

  async getBrowserOptions() {
    await this.ensureLoaded();
    return this.data.browser;
  }

  private async setApiKey(value: string | null) {
    const keytar = await getKeytar();
    if (value === null) {
      if (keytar && this.data.llm.apiKeyAlias) {
        try {
          await keytar.deletePassword(SERVICE_NAME, this.data.llm.apiKeyAlias);
        } catch (error) {
          log.warn('Failed to delete API key from keytar', error);
        }
      }
      this.data.llm.apiKeyAlias = undefined;
      this.data.llm.apiKeyFallback = undefined;
      return;
    }

    if (keytar) {
      try {
        await keytar.setPassword(SERVICE_NAME, LLM_KEY_ALIAS, value);
        this.data.llm.apiKeyAlias = LLM_KEY_ALIAS;
        this.data.llm.apiKeyFallback = undefined;
        return;
      } catch (error) {
        log.warn('Failed to store API key via keytar, falling back to file', error);
      }
    }

    this.data.llm.apiKeyFallback = value;
  }

  private async getApiKey(): Promise<string | null> {
    if (!this.initialized) {
      await this.ensureLoaded();
    }
    if (this.data.llm.apiKeyAlias) {
      const keytar = await getKeytar();
      if (keytar) {
        try {
          const value = await keytar.getPassword(SERVICE_NAME, this.data.llm.apiKeyAlias);
          if (value) {
            return value;
          }
        } catch (error) {
          log.warn('Failed to read API key from keytar', error);
        }
      }
    }
    return this.data.llm.apiKeyFallback ?? null;
  }
}

export type SettingsEvents = {
  updated: (settings: LlmSettingsView) => void;
  'browser-updated': (settings: RawSettings['browser']) => void;
};

