import { contextBridge, ipcRenderer } from 'electron';

type BackendInfo = {
  baseUrl: string;
  cookiesPath: string;
  addr: string;
};

const backendAPI = {
  async getInfo(): Promise<BackendInfo> {
    return ipcRenderer.invoke('backend:get-info');
  },
  async getStatus() {
    return ipcRenderer.invoke('backend:get-status');
  },
  onStatus(listener: (payload: any) => void) {
    const channel = 'backend:status';
    const handler = (_event: Electron.IpcRendererEvent, payload: any) => {
      listener(payload);
    };
    ipcRenderer.on(channel, handler);
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  }
};

const appAPI = {
  openExternal(url: string) {
    return ipcRenderer.invoke('app:open-external', url);
  },
  async getPlatform() {
    return ipcRenderer.invoke('app:get-platform');
  },
  async getAppList() {
    return ipcRenderer.invoke('app:get-list');
  },
  async getAppInfo(appId: string) {
    return ipcRenderer.invoke('app:get-info', appId);
  }
};

const settingsAPI = {
  getLlmSettings() {
    return ipcRenderer.invoke('settings:get-llm');
  },
  updateLlmSettings(payload: {
    provider?: string;
    model?: string;
    baseUrl?: string;
    apiKey?: string | null;
    headers?: Record<string, string>;
  }) {
    return ipcRenderer.invoke('settings:update-llm', payload);
  },
  getBrowserOptions() {
    return ipcRenderer.invoke('settings:get-browser');
  },
  updateBrowserOptions(payload: { binPath?: string; headless?: boolean }) {
    return ipcRenderer.invoke('settings:update-browser', payload);
  }
};

const conversationAPI = {
  getState() {
    return ipcRenderer.invoke('conversation:get-state');
  },
  sendMessage(content: string) {
    return ipcRenderer.invoke('conversation:send', { content });
  },
  reset() {
    return ipcRenderer.invoke('conversation:reset');
  },
  onMessage(listener: (message: any) => void) {
    const channel = 'conversation:message';
    ipcRenderer.on(channel, (_event, payload) => listener(payload));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onStatus(listener: (payload: any) => void) {
    const channel = 'conversation:status';
    ipcRenderer.on(channel, (_event, payload) => listener(payload));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onError(listener: (payload: any) => void) {
    const channel = 'conversation:error';
    ipcRenderer.on(channel, (_event, payload) => listener(payload));
    return () => ipcRenderer.removeAllListeners(channel);
  }
};

contextBridge.exposeInMainWorld('backendAPI', backendAPI);
contextBridge.exposeInMainWorld('appAPI', appAPI);
contextBridge.exposeInMainWorld('settingsAPI', settingsAPI);
contextBridge.exposeInMainWorld('conversationAPI', conversationAPI);

