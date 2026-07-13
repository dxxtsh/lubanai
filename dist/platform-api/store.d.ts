import { AgentDefinition, ConfigEntry, LogEntry, LogLevel, PluginInfo, ProviderConfig, RuntimeState, SkillInfo, WorkspaceInfo } from '../shared/types.js';
import { saveConfigs, saveWorkspaces, saveAgents, saveProviders, saveSkills, savePlugins, saveLogs } from './persistence.js';
export declare const runtimeSteps: readonly [{
    readonly id: "check";
    readonly label: "环境检测";
    readonly detail: "检查便携目录、Node Runtime 与 OpenClaw 入口";
}, {
    readonly id: "runtime";
    readonly label: "加载 Runtime";
    readonly detail: "准备 OpenClaw 运行时适配层";
}, {
    readonly id: "plugins";
    readonly label: "加载插件";
    readonly detail: "扫描 plugins 目录并初始化扩展点";
}, {
    readonly id: "workspace";
    readonly label: "加载工作区";
    readonly detail: "读取 workspace 配置与索引";
}, {
    readonly id: "agents";
    readonly label: "加载 Agents";
    readonly detail: "装载多智能体定义与技能绑定";
}];
export declare const store: {
    runtime: RuntimeState;
    configs: ConfigEntry[];
    workspaces: WorkspaceInfo[];
    agents: AgentDefinition[];
    providers: ProviderConfig[];
    skills: SkillInfo[];
    plugins: PluginInfo[];
    logs: LogEntry[];
};
export declare function pushLog(module: string, message: string, level?: LogLevel): void;
export declare function createId(prefix: string): string;
export declare function persistAll(): void;
export { saveConfigs, saveWorkspaces, saveAgents, saveProviders, saveSkills, savePlugins, saveLogs };
//# sourceMappingURL=store.d.ts.map