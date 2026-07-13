import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import { ConfigEntry, ValidationResult } from '../../shared/types.js';
import { pushLog, saveConfigs, store } from '../store.js';

export class ConfigManager {
  register(): void {
    ipcMain.handle(IPC_CHANNELS.CONFIG_LIST, async (_e, category?: string) =>
      this.listByCategory(category),
    );
    ipcMain.handle(IPC_CHANNELS.CONFIG_READ, (_e, key: string) =>
      store.configs.find((entry) => entry.key === key),
    );
    ipcMain.handle(IPC_CHANNELS.CONFIG_SAVE, async (_e, key: string, value: ConfigEntry['value']) =>
      this.save(key, value),
    );
    ipcMain.handle(IPC_CHANNELS.CONFIG_VALIDATE, async () => this.validate());
  }

  listByCategory(category?: string): ConfigEntry[] {
    if (!category) return store.configs;
    return store.configs.filter((entry) => entry.category === category);
  }

  save(key: string, value: ConfigEntry['value']): { success: boolean; entry?: ConfigEntry } {
    const entry = store.configs.find((item) => item.key === key);
    if (!entry) {
      return { success: false };
    }

    entry.value = value;
    saveConfigs(store.configs);
    pushLog('config', `配置已更新：${entry.label}`);
    return { success: true, entry };
  }

  validate(): ValidationResult {
    const errors: string[] = [];

    for (const entry of store.configs) {
      // 必填检查：required 标记或 type 为 string 且为空
      if (entry.required && (entry.value === '' || entry.value === undefined)) {
        errors.push(`${entry.label} 不能为空`);
        continue;
      }

      // 类型检查
      if (entry.type === 'number' && typeof entry.value !== 'number' && entry.value !== '') {
        errors.push(`${entry.label} 应为数字类型`);
        continue;
      }

      // 枚举值检查
      if (entry.enumOptions && entry.enumOptions.length > 0 && entry.value !== '') {
        const validValues = entry.enumOptions.map((opt) => opt.value);
        if (!validValues.includes(String(entry.value))) {
          errors.push(`${entry.label} 的值不在允许范围内`);
          continue;
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
