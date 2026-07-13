import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import { pushLog, savePlugins, store } from '../store.js';
export class PluginManager {
    register() {
        ipcMain.handle(IPC_CHANNELS.PLUGIN_LIST, async () => store.plugins);
        ipcMain.handle(IPC_CHANNELS.PLUGIN_TOGGLE, async (_e, id) => this.toggle(id));
        ipcMain.handle(IPC_CHANNELS.PLUGIN_LOAD, async (_e, pluginPath) => ({
            success: true,
            message: `插件目录已登记：${pluginPath}`,
        }));
        ipcMain.handle(IPC_CHANNELS.PLUGIN_UNLOAD, async (_e, id) => this.disable(id));
    }
    toggle(id) {
        const plugin = store.plugins.find((item) => item.id === id);
        if (!plugin) {
            return { success: false };
        }
        plugin.enabled = !plugin.enabled;
        savePlugins(store.plugins);
        pushLog('plugin', `${plugin.name} 已${plugin.enabled ? '启用' : '禁用'}`);
        return { success: true };
    }
    disable(id) {
        const plugin = store.plugins.find((item) => item.id === id);
        if (!plugin) {
            return { success: false };
        }
        plugin.enabled = false;
        savePlugins(store.plugins);
        pushLog('plugin', `${plugin.name} 已卸载`);
        return { success: true };
    }
}
//# sourceMappingURL=manager.js.map