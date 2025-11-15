/// <reference types="vite/client" />

interface Window {
  backendAPI: {
    getInfo(): Promise<{
      baseUrl: string;
      cookiesPath: string;
      addr: string;
      wsUrl?: string;
      port?: number;
    }>;
    getStatus(): Promise<{
      go: {
        exists: boolean;
        running: boolean;
        status: string;
      };
      python: {
        exists: boolean;
        running: boolean;
        status: string;
        reason: string;
      };
    }>;
    onStatus(listener: (payload: any) => void): () => void;
  };
  appAPI: {
    openExternal(url: string): Promise<void>;
    getPlatform(): Promise<{ platform: string; release: string }>;
    getAppList(): Promise<any[]>;
    getAppInfo(appId: string): Promise<any>;
  };
  settingsAPI: {
    getLlmSettings(): Promise<any>;
    updateLlmSettings(payload: any): Promise<void>;
    getBrowserOptions(): Promise<any>;
    updateBrowserOptions(payload: any): Promise<void>;
  };
  conversationAPI: {
    getState(): Promise<any>;
    sendMessage(content: string): Promise<any>;
    reset(): Promise<void>;
    onMessage(listener: (message: any) => void): () => void;
    onStatus(listener: (payload: any) => void): () => void;
    onError(listener: (payload: any) => void): () => void;
  };
}

