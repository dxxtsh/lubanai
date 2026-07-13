import { ipcMain } from 'electron';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { IPC_CHANNELS, CONFIG_FILES, DIRECTORIES } from '../../shared/constants.js';
const ROOT = resolve(DIRECTORIES.ROOT || '.');
const configDir = resolve(ROOT, DIRECTORIES.CONFIG);
function getChannelsPath() {
    return resolve(configDir, CONFIG_FILES.CHANNELS);
}
const defaultChannels = [
    {
        id: 'channel-telegram',
        type: 'telegram',
        name: 'Telegram',
        enabled: false,
        config: { token: '' },
        status: 'disconnected',
    },
    {
        id: 'channel-lark',
        type: 'lark',
        name: '飞书 / Lark',
        enabled: false,
        config: { appId: '', appSecret: '' },
        status: 'disconnected',
    },
    {
        id: 'channel-matrix',
        type: 'matrix',
        name: 'Matrix',
        enabled: false,
        config: { homeserver: '', accessToken: '', roomId: '' },
        status: 'disconnected',
    },
    {
        id: 'channel-wechat',
        type: 'wechat',
        name: '微信（敬请期待）',
        enabled: false,
        config: {},
        status: 'pending',
        statusMessage: '微信渠道将在后续版本支持',
    },
];
function loadChannels() {
    try {
        mkdirSync(configDir, { recursive: true });
        const p = getChannelsPath();
        if (!existsSync(p)) {
            writeFileSync(p, JSON.stringify(defaultChannels, null, 2), 'utf-8');
            return defaultChannels;
        }
        return JSON.parse(readFileSync(p, 'utf-8'));
    }
    catch {
        return defaultChannels;
    }
}
function saveChannels(channels) {
    try {
        mkdirSync(configDir, { recursive: true });
        writeFileSync(getChannelsPath(), JSON.stringify(channels, null, 2), 'utf-8');
    }
    catch (e) {
        console.error('[ChannelManager] 保存失败:', e);
    }
}
export class ChannelManager {
    channels = loadChannels();
    register() {
        ipcMain.handle(IPC_CHANNELS.CHANNEL_LIST, () => this.channels);
        ipcMain.handle(IPC_CHANNELS.CHANNEL_SAVE, (_event, id, config) => {
            const idx = this.channels.findIndex((c) => c.id === id);
            if (idx !== -1) {
                this.channels[idx] = { ...this.channels[idx], config };
                saveChannels(this.channels);
                return { success: true };
            }
            return { success: false, message: 'Channel not found' };
        });
        ipcMain.handle(IPC_CHANNELS.CHANNEL_TOGGLE, (_event, id) => {
            const ch = this.channels.find((c) => c.id === id);
            if (ch && ch.type !== 'wechat') {
                ch.enabled = !ch.enabled;
                ch.status = ch.enabled ? 'connected' : 'disconnected';
                saveChannels(this.channels);
                return { success: true, enabled: ch.enabled };
            }
            return { success: false, message: 'Cannot toggle this channel' };
        });
        ipcMain.handle(IPC_CHANNELS.CHANNEL_TEST, (_event, id) => {
            const ch = this.channels.find((c) => c.id === id);
            if (!ch)
                return { success: false, message: 'Channel not found' };
            if (ch.type === 'wechat')
                return { success: false, message: '微信渠道暂未支持' };
            // Basic validation: check required fields
            const missing = [];
            if (ch.type === 'telegram' && !ch.config.token)
                missing.push('Token');
            if (ch.type === 'lark' && (!ch.config.appId || !ch.config.appSecret))
                missing.push('AppID / AppSecret');
            if (ch.type === 'matrix' && (!ch.config.homeserver || !ch.config.accessToken))
                missing.push('Homeserver / Access Token');
            if (missing.length > 0) {
                return { success: false, message: `缺少必填项: ${missing.join(', ')}` };
            }
            return { success: true, message: '配置验证通过（需启动后实际连接测试）' };
        });
    }
    getChannels() {
        return this.channels;
    }
}
//# sourceMappingURL=manager.js.map