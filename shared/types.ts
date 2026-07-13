export enum RuntimeStatus {
  STOPPED = 'stopped',
  CHECKING = 'checking',
  LOADING_RUNTIME = 'loading_runtime',
  LOADING_PLUGINS = 'loading_plugins',
  LOADING_WORKSPACE = 'loading_workspace',
  LOADING_AGENTS = 'loading_agents',
  RUNNING = 'running',
  STOPPING = 'stopping',
  ERROR = 'error',
}

export interface RuntimeStep {
  id: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail: string;
}

export interface RuntimeRecoveryInfo {
  restartCount: number;
  maxAttempts: number;
  lastError?: string;
}

export interface RuntimeState {
  status: RuntimeStatus;
  pid?: number | null;
  startedAt?: string | null;
  message: string;
  steps: RuntimeStep[];
  healthCheck?: 'healthy' | 'unhealthy' | 'checking';
  recoveryInfo?: RuntimeRecoveryInfo;
}

export interface RuntimeResult {
  success: boolean;
  message?: string;
  state?: RuntimeState;
  recoveryInfo?: RuntimeRecoveryInfo;
}

export interface ConfigEntry {
  key: string;
  label: string;
  value: string | number | boolean;
  category: 'provider' | 'model' | 'workspace' | 'skills' | 'channels' | 'plugins' | 'logging';
  description?: string;
  type?: 'string' | 'number' | 'boolean' | 'enum';
  enumOptions?: { label: string; value: string }[];
  sensitive?: boolean;
  required?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

export type ProviderType = 'openai' | 'openai-compatible' | 'ollama' | 'vllm' | 'custom';

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  createdAt: string;
  updatedAt: string;
}

export type ChannelType = 'terminal' | 'lark' | 'telegram' | 'matrix' | 'wechat';

export interface ChannelBinding {
  type: ChannelType;
  enabled: boolean;
  config?: Record<string, string>;
}

export interface ChannelConfig {
  id: string;
  type: ChannelType;
  name: string;
  enabled: boolean;
  config: Record<string, string>;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  statusMessage?: string;
}

export interface AgentDefinition {
  id: string;
  name: string;
  avatar: string;
  color: string;
  description: string;
  providerId: string;
  modelName: string;
  systemPrompt: string;
  workspaceId: string;
  skills: string[];
  channels: ChannelBinding[];
  enabled: boolean;
}

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  version?: string;
  category?: string;
}

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  enabled: boolean;
  path: string;
}

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
}

export interface PlatformSnapshot {
  runtime: RuntimeState;
  configs: ConfigEntry[];
  workspaces: WorkspaceInfo[];
  agents: AgentDefinition[];
  providers: ProviderConfig[];
  skills: SkillInfo[];
  plugins: PluginInfo[];
  channels: ChannelConfig[];
  logs: LogEntry[];
}
