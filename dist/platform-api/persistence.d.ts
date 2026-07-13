import { AgentDefinition, ConfigEntry, LogEntry, PluginInfo, ProviderConfig, SkillInfo, WorkspaceInfo } from '../shared/types.js';
interface PersistedData {
    configs: ConfigEntry[];
    workspaces: WorkspaceInfo[];
    agents: AgentDefinition[];
    providers: ProviderConfig[];
    skills: SkillInfo[];
    plugins: PluginInfo[];
    logs: LogEntry[];
}
export declare function loadAll(): PersistedData;
export declare function saveConfigs(configs: ConfigEntry[]): void;
export declare function saveWorkspaces(workspaces: WorkspaceInfo[]): void;
export declare function saveAgents(agents: AgentDefinition[]): void;
export declare function saveProviders(providers: ProviderConfig[]): void;
export declare function saveSkills(skills: SkillInfo[]): void;
export declare function savePlugins(plugins: PluginInfo[]): void;
export declare function saveLogs(logs: LogEntry[]): void;
export {};
//# sourceMappingURL=persistence.d.ts.map