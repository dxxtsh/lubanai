import { LogLevel, RuntimeStatus, } from '../shared/types.js';
import { loadAll, saveConfigs, saveWorkspaces, saveAgents, saveProviders, saveSkills, savePlugins, saveLogs } from './persistence.js';
const now = () => new Date().toISOString();
export const runtimeSteps = [
    { id: 'check', label: '环境检测', detail: '检查便携目录、Node Runtime 与 OpenClaw 入口' },
    { id: 'runtime', label: '加载 Runtime', detail: '准备 OpenClaw 运行时适配层' },
    { id: 'plugins', label: '加载插件', detail: '扫描 plugins 目录并初始化扩展点' },
    { id: 'workspace', label: '加载工作区', detail: '读取 workspace 配置与索引' },
    { id: 'agents', label: '加载 Agents', detail: '装载多智能体定义与技能绑定' },
];
const persisted = loadAll();
export const store = {
    runtime: {
        status: RuntimeStatus.STOPPED,
        pid: null,
        startedAt: null,
        message: 'Runtime 未启动',
        steps: runtimeSteps.map((step) => ({ ...step, status: 'pending' })),
    },
    configs: persisted.configs,
    workspaces: persisted.workspaces,
    agents: persisted.agents,
    providers: persisted.providers,
    skills: persisted.skills,
    plugins: persisted.plugins,
    logs: persisted.logs,
};
export function pushLog(module, message, level = LogLevel.INFO) {
    store.logs.unshift({
        timestamp: now(),
        level,
        module,
        message,
    });
    store.logs = store.logs.slice(0, 200);
    saveLogs(store.logs);
}
export function createId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
export function persistAll() {
    saveConfigs(store.configs);
    saveWorkspaces(store.workspaces);
    saveAgents(store.agents);
    saveProviders(store.providers);
    saveSkills(store.skills);
    savePlugins(store.plugins);
    saveLogs(store.logs);
}
export { saveConfigs, saveWorkspaces, saveAgents, saveProviders, saveSkills, savePlugins, saveLogs };
//# sourceMappingURL=store.js.map