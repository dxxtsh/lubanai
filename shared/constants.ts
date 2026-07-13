export const APP_NAME = '钉哥联盟 AI 智盘';
export const APP_VERSION = '0.2.0';
export const APP_BRAND = '钉哥联盟';

export const DIRECTORIES = {
  ROOT: '',
  RUNTIME: 'runtime',
  LAUNCHER: 'launcher',
  CONFIG: 'config',
  WORKSPACE: 'workspace',
  SKILLS: 'skills',
  PLUGINS: 'plugins',
  DATA: 'data',
  CACHE: 'cache',
  LOGS: 'logs',
  TEMP: 'temp',
  UPDATE: 'update',
  ASSETS: 'assets',
  DOCS: 'docs',
} as const;

export const CONFIG_FILES = {
  MAIN: 'lubanai.json',
  PROVIDERS: 'providers.json',
  WORKSPACE: 'workspaces.json',
  AGENTS: 'agents.json',
  SKILLS: 'skills.json',
  PLUGINS: 'plugins.json',
  CHANNELS: 'channels.json',
  LOGGING: 'logging.json',
} as const;

export const IPC_CHANNELS = {
  RUNTIME_START: 'platform:runtime:start',
  RUNTIME_STOP: 'platform:runtime:stop',
  RUNTIME_RESTART: 'platform:runtime:restart',
  RUNTIME_STATUS: 'platform:runtime:status',

  CONFIG_LIST: 'platform:config:list',
  CONFIG_READ: 'platform:config:read',
  CONFIG_SAVE: 'platform:config:save',
  CONFIG_VALIDATE: 'platform:config:validate',

  WORKSPACE_LIST: 'platform:workspace:list',
  WORKSPACE_CREATE: 'platform:workspace:create',
  WORKSPACE_DELETE: 'platform:workspace:delete',
  WORKSPACE_RENAME: 'platform:workspace:rename',
  WORKSPACE_EXPORT: 'platform:workspace:export',
  WORKSPACE_IMPORT: 'platform:workspace:import',
  WORKSPACE_CLONE: 'platform:workspace:clone',

  AGENT_LIST: 'platform:agent:list',
  AGENT_CREATE: 'platform:agent:create',
  AGENT_UPDATE: 'platform:agent:update',
  AGENT_DELETE: 'platform:agent:delete',
  AGENT_DUPLICATE: 'platform:agent:duplicate',
  AGENT_EXPORT: 'platform:agent:export',
  AGENT_IMPORT: 'platform:agent:import',

  PROVIDER_LIST: 'platform:provider:list',
  PROVIDER_CREATE: 'platform:provider:create',
  PROVIDER_UPDATE: 'platform:provider:update',
  PROVIDER_DELETE: 'platform:provider:delete',
  PROVIDER_TEST: 'platform:provider:test',

  SKILL_LIST: 'platform:skill:list',
  SKILL_TOGGLE: 'platform:skill:toggle',
  SKILL_INSTALL: 'platform:skill:install',
  SKILL_REMOVE: 'platform:skill:remove',

  PLUGIN_LIST: 'platform:plugin:list',
  PLUGIN_TOGGLE: 'platform:plugin:toggle',
  PLUGIN_LOAD: 'platform:plugin:load',
  PLUGIN_UNLOAD: 'platform:plugin:unload',

  CHANNEL_LIST: 'platform:channel:list',
  CHANNEL_SAVE: 'platform:channel:save',
  CHANNEL_TOGGLE: 'platform:channel:toggle',
  CHANNEL_TEST: 'platform:channel:test',

  LOG_READ: 'platform:log:read',
  LOG_EXPORT: 'platform:log:export',

  SNAPSHOT: 'platform:snapshot',

  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
} as const;
