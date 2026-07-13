import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import { pushLog, saveConfigs, store } from '../store.js';
export class ConfigManager {
    register() {
        ipcMain.handle(IPC_CHANNELS.CONFIG_LIST, async (_e, category) => this.listByCategory(category));
        ipcMain.handle(IPC_CHANNELS.CONFIG_READ, (_e, key) => store.configs.find((entry) => entry.key === key));
        ipcMain.handle(IPC_CHANNELS.CONFIG_SAVE, async (_e, key, value) => this.save(key, value));
        ipcMain.handle(IPC_CHANNELS.CONFIG_VALIDATE, async () => this.validate());
    }
    listByCategory(category) {
        if (!category)
            return store.configs;
        return store.configs.filter((entry) => entry.category === category);
    }
    save(key, value) {
        const entry = store.configs.find((item) => item.key === key);
        if (!entry) {
            return { success: false };
        }
        entry.value = value;
        saveConfigs(store.configs);
        pushLog('config', `配置已更新：${entry.label}`);
        return { success: true, entry };
    }
    validate() {
        const errors = [];
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
//# sourceMappingURL=manager.js.map