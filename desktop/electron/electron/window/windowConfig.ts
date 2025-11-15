import { configManager } from '../config';

/**
 * 窗口配置
 */
export interface WindowConfig {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  autoHideMenuBar: boolean;
}

/**
 * 获取窗口配置
 */
export function getWindowConfig(): WindowConfig {
  return configManager.get('window');
}

