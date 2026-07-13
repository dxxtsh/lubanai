import { ipcMain } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { DIRECTORIES, IPC_CHANNELS } from '../../shared/constants.js';
import { createId, pushLog, saveAgents, store } from '../store.js';
export class AgentManager {
    register() {
        ipcMain.handle(IPC_CHANNELS.AGENT_LIST, async () => store.agents);
        ipcMain.handle(IPC_CHANNELS.AGENT_CREATE, async () => this.create());
        ipcMain.handle(IPC_CHANNELS.AGENT_UPDATE, async (_e, agent) => this.update(agent));
        ipcMain.handle(IPC_CHANNELS.AGENT_DELETE, async (_e, id) => this.delete(id));
        ipcMain.handle(IPC_CHANNELS.AGENT_DUPLICATE, async (_e, id) => this.duplicate(id));
        ipcMain.handle(IPC_CHANNELS.AGENT_EXPORT, async (_e, id) => this.export(id));
        ipcMain.handle(IPC_CHANNELS.AGENT_IMPORT, async (_e, filePath) => this.import(filePath));
    }
    create() {
        const workspaceId = store.workspaces[0]?.id ?? 'workspace-default';
        const providerId = store.providers[0]?.id ?? 'prov-default';
        const modelName = store.providers[0]?.defaultModel ?? 'gpt-4.1';
        const agent = {
            id: createId('agent'),
            name: '新建 Agent',
            avatar: 'AI',
            color: '#22c55e',
            description: '可视化创建的智能体。',
            providerId,
            modelName,
            systemPrompt: '你是一个 LubanAI Agent。',
            workspaceId,
            skills: [],
            channels: [{ type: 'terminal', enabled: true }],
            enabled: true,
        };
        store.agents.unshift(agent);
        saveAgents(store.agents);
        pushLog('agent', `Agent 已创建：${agent.name}`);
        return { success: true, agent };
    }
    update(agent) {
        const index = store.agents.findIndex((item) => item.id === agent.id);
        if (index < 0) {
            return { success: false };
        }
        store.agents[index] = agent;
        saveAgents(store.agents);
        pushLog('agent', `Agent 已更新：${agent.name}`);
        return { success: true, agent };
    }
    delete(id) {
        const index = store.agents.findIndex((agent) => agent.id === id);
        if (index < 0) {
            return { success: false };
        }
        const [agent] = store.agents.splice(index, 1);
        saveAgents(store.agents);
        pushLog('agent', `Agent 已删除：${agent.name}`);
        return { success: true };
    }
    duplicate(id) {
        const source = store.agents.find((agent) => agent.id === id);
        if (!source) {
            return { success: false };
        }
        const agent = {
            ...source,
            id: createId('agent'),
            name: `${source.name} 副本`,
        };
        store.agents.unshift(agent);
        saveAgents(store.agents);
        pushLog('agent', `Agent 已复制：${source.name}`);
        return { success: true, agent };
    }
    export(id) {
        const agent = store.agents.find((a) => a.id === id);
        if (!agent) {
            return { success: false, message: 'Agent 不存在' };
        }
        const exportData = {
            version: '1.0',
            type: 'lubanai-agent',
            agent,
            exportedAt: new Date().toISOString(),
        };
        const dataDir = resolve(DIRECTORIES.ROOT || '.', DIRECTORIES.DATA);
        if (!existsSync(dataDir))
            mkdirSync(dataDir, { recursive: true });
        const exportPath = resolve(dataDir, `agent-${agent.id}.json`);
        writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
        pushLog('agent', `Agent 已导出：${agent.name}`);
        return { success: true, path: exportPath };
    }
    import(filePath) {
        try {
            const raw = readFileSync(filePath, 'utf-8');
            const data = JSON.parse(raw);
            if (data.type !== 'lubanai-agent' || !data.agent) {
                return { success: false, message: '无效的 Agent 文件' };
            }
            const agent = {
                ...data.agent,
                id: createId('agent'),
                name: `${data.agent.name} (导入)`,
            };
            store.agents.unshift(agent);
            saveAgents(store.agents);
            pushLog('agent', `Agent 已导入：${agent.name}`);
            return { success: true, agent };
        }
        catch {
            return { success: false, message: '文件解析失败' };
        }
    }
}
//# sourceMappingURL=manager.js.map