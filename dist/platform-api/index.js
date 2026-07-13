import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../shared/constants.js';
import { store } from './store.js';
export { AgentManager } from './agent/manager.js';
export { ChannelManager } from './channel/manager.js';
export { ConfigManager } from './config/manager.js';
export { LogManager } from './log/manager.js';
export { PluginManager } from './plugin/manager.js';
export { ProviderManager } from './provider/manager.js';
export { RuntimeManager } from './runtime/manager.js';
export { SkillManager } from './skill/manager.js';
export { WorkspaceManager } from './workspace/manager.js';
export function registerPlatformSnapshot(channelManager) {
    ipcMain.handle(IPC_CHANNELS.SNAPSHOT, async () => ({
        runtime: store.runtime,
        configs: store.configs,
        workspaces: store.workspaces,
        agents: store.agents,
        providers: store.providers,
        skills: store.skills,
        plugins: store.plugins,
        channels: channelManager.getChannels(),
        logs: store.logs,
    }));
}
//# sourceMappingURL=index.js.map