import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { CONFIG_FILES, DIRECTORIES } from '../shared/constants.js';
import {
  AgentDefinition,
  ConfigEntry,
  LogEntry,
  LogLevel,
  PluginInfo,
  ProviderConfig,
  SkillInfo,
  WorkspaceInfo,
} from '../shared/types.js';

const CONFIG_DIR = resolve(DIRECTORIES.ROOT || '.', 'config');
const WORKSPACE_DIR = resolve(DIRECTORIES.ROOT || '.', 'workspace');

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readJson<T>(relativePath: string, fallback: T): T {
  const fullPath = resolve(CONFIG_DIR, relativePath);
  if (!existsSync(fullPath)) return fallback;
  try {
    return JSON.parse(readFileSync(fullPath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(relativePath: string, data: unknown): void {
  const fullPath = resolve(CONFIG_DIR, relativePath);
  ensureDir(fullPath);
  writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
}

const now = () => new Date().toISOString();

interface PersistedData {
  configs: ConfigEntry[];
  workspaces: WorkspaceInfo[];
  agents: AgentDefinition[];
  providers: ProviderConfig[];
  skills: SkillInfo[];
  plugins: PluginInfo[];
  logs: LogEntry[];
}

export function loadAll(): PersistedData {
  const configs = readJson<ConfigEntry[]>(CONFIG_FILES.MAIN, [
    { key: 'runtime.port', label: 'Runtime 端口', category: 'channels', value: 8080, description: 'OpenClaw Runtime 监听端口。', type: 'number' },
    { key: 'runtime.autoStart', label: '开机自启', category: 'channels', value: false, description: '应用启动时自动拉起 Runtime。', type: 'boolean' },
    { key: 'runtime.logLevel', label: '日志级别', category: 'logging', value: 'info', description: 'Runtime 日志输出级别。', type: 'enum', enumOptions: [
      { label: 'ERROR', value: 'error' },
      { label: 'WARN', value: 'warn' },
      { label: 'INFO', value: 'info' },
      { label: 'DEBUG', value: 'debug' },
    ]},
    { key: 'theme', label: '主题', category: 'workspace', value: 'dark', description: '界面主题。', type: 'enum', enumOptions: [
      { label: '深色', value: 'dark' },
      { label: '浅色', value: 'light' },
    ]},
    { key: 'defaultWorkspace', label: '默认工作区', category: 'workspace', value: 'workspace-default', description: '新建 Agent 的默认工作区。' },
  ]);
  const workspaces = readJson<WorkspaceInfo[]>(CONFIG_FILES.WORKSPACE, [
    { id: 'workspace-default', name: '默认工作区', path: `${WORKSPACE_DIR}/default`, createdAt: now(), updatedAt: now() },
    { id: 'workspace-lab', name: '实验工作区', path: `${WORKSPACE_DIR}/lab`, createdAt: now(), updatedAt: now() },
  ]);
  const agents = readJson<AgentDefinition[]>(CONFIG_FILES.AGENTS, [
    { id: 'agent-ops', name: '运维助手', avatar: 'OP', color: '#38bdf8', description: '负责环境检查、日志排查与启动诊断。', providerId: 'prov-default', modelName: 'gpt-4.1', systemPrompt: '你是钉哥联盟 AI 智盘的运维助手，优先输出可执行的诊断步骤。', workspaceId: 'workspace-default', skills: ['log-reader', 'workspace-tools'], channels: [{ type: 'terminal', enabled: true }], enabled: true },
    { id: 'agent-dev', name: '开发助手', avatar: 'DV', color: '#f59e0b', description: '面向开发者的 Agent 编排与插件开发助手。', providerId: 'prov-default', modelName: 'gpt-4.1-mini', systemPrompt: '你是钉哥联盟 AI 智盘的开发助手，保持 OpenClaw 兼容性优先。', workspaceId: 'workspace-default', skills: ['plugin-sdk', 'workspace-tools'], channels: [{ type: 'terminal', enabled: true }], enabled: true },
  ]);
  const providers = readJson<ProviderConfig[]>(CONFIG_FILES.PROVIDERS, [
    { id: 'prov-default', name: '默认 Provider', type: 'openai-compatible', baseUrl: 'https://api.openai.com/v1', apiKey: '', defaultModel: 'gpt-4.1', createdAt: now(), updatedAt: now() },
  ]);
  const skills = readJson<SkillInfo[]>(CONFIG_FILES.SKILLS, [
    { id: 'workspace-tools', name: 'Workspace Tools', description: '工作区文件、索引与导入导出能力。', enabled: true, version: '0.1.0', category: 'system' },
    { id: 'log-reader', name: 'Log Reader', description: '读取、过滤与导出运行日志。', enabled: true, version: '0.1.0', category: 'standard' },
    { id: 'plugin-sdk', name: 'Plugin SDK', description: '插件脚手架、Manifest 校验与扩展点调试。', enabled: false, version: '0.1.0', category: 'dev-tool' },
  ]);
  const plugins = readJson<PluginInfo[]>(CONFIG_FILES.PLUGINS, [
    { id: 'plugin-ragflow', name: 'RAGFlow Bridge', version: '0.1.0', description: '预留 RAGFlow 集成插件。', enabled: false, path: `${DIRECTORIES.PLUGINS}/ragflow` },
    { id: 'plugin-mcp', name: 'MCP Gateway', version: '0.1.0', description: '预留 MCP 工具网关插件。', enabled: false, path: `${DIRECTORIES.PLUGINS}/mcp` },
  ]);
  const logs = readJson<LogEntry[]>(CONFIG_FILES.LOGGING, [
    { timestamp: now(), level: LogLevel.INFO, module: 'persistence', message: '钉哥联盟 AI 智盘 配置已加载。' },
  ]);
  return { configs, workspaces, agents, providers, skills, plugins, logs };
}

export function saveConfigs(configs: ConfigEntry[]): void {
  writeJson(CONFIG_FILES.MAIN, configs);
}
export function saveWorkspaces(workspaces: WorkspaceInfo[]): void {
  writeJson(CONFIG_FILES.WORKSPACE, workspaces);
}
export function saveAgents(agents: AgentDefinition[]): void {
  writeJson(CONFIG_FILES.AGENTS, agents);
}
export function saveProviders(providers: ProviderConfig[]): void {
  writeJson(CONFIG_FILES.PROVIDERS, providers);
}
export function saveSkills(skills: SkillInfo[]): void {
  writeJson(CONFIG_FILES.SKILLS, skills);
}
export function savePlugins(plugins: PluginInfo[]): void {
  writeJson(CONFIG_FILES.PLUGINS, plugins);
}
export function saveLogs(logs: LogEntry[]): void {
  writeJson(CONFIG_FILES.LOGGING, logs);
}
