import { ipcMain } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, renameSync, copyFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';
import { DIRECTORIES, IPC_CHANNELS } from '../../shared/constants.js';
import { WorkspaceInfo, LogLevel } from '../../shared/types.js';
import { createId, pushLog, saveWorkspaces, store, saveAgents } from '../store.js';

const WORKSPACE_DIR = resolve(DIRECTORIES.ROOT || '.', DIRECTORIES.WORKSPACE);
const EXPORTS_DIR = resolve(DIRECTORIES.ROOT || '.', DIRECTORIES.DATA);

function ensureWorkspaceDir(): void {
  if (!existsSync(WORKSPACE_DIR)) {
    mkdirSync(WORKSPACE_DIR, { recursive: true });
  }
}

function nameToDirName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-');
}

function copyWorkspaceFiles(sourcePath: string, targetPath: string): void {
  if (!existsSync(sourcePath)) return;
  mkdirSync(targetPath, { recursive: true });
  const entries = readdirSync(sourcePath);
  for (const entry of entries) {
    const srcPath = resolve(sourcePath, entry);
    const destPath = resolve(targetPath, entry);
    const statInfo = statSync(srcPath);
    if (statInfo.isDirectory()) {
      copyWorkspaceFiles(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

export class WorkspaceManager {
  register(): void {
    ipcMain.handle(IPC_CHANNELS.WORKSPACE_LIST, async () => store.workspaces);
    ipcMain.handle(IPC_CHANNELS.WORKSPACE_CREATE, async (_e, name: string) => this.create(name));
    ipcMain.handle(IPC_CHANNELS.WORKSPACE_DELETE, async (_e, id: string) => this.delete(id));
    ipcMain.handle(IPC_CHANNELS.WORKSPACE_RENAME, async (_e, id: string, name: string) => this.rename(id, name));
    ipcMain.handle(IPC_CHANNELS.WORKSPACE_EXPORT, async (_e, id: string) => this.export(id));
    ipcMain.handle(IPC_CHANNELS.WORKSPACE_IMPORT, async (_e, filePath: string) => this.import(filePath));
    ipcMain.handle(IPC_CHANNELS.WORKSPACE_CLONE, async (_e, id: string, name: string) => this.clone(id, name));
  }

  create(name: string): { success: boolean; workspace?: WorkspaceInfo; message?: string } {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, message: '工作区名称不能为空' };
    }
    ensureWorkspaceDir();
    const dirName = nameToDirName(trimmedName);
    const wsPath = resolve(WORKSPACE_DIR, dirName);
    if (!existsSync(wsPath)) {
      mkdirSync(wsPath, { recursive: true });
    }
    const workspace: WorkspaceInfo = {
      id: createId('workspace'),
      name: trimmedName,
      path: wsPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.workspaces.unshift(workspace);
    saveWorkspaces(store.workspaces);
    pushLog('workspace', `工作区已创建：${workspace.name}`);
    return { success: true, workspace };
  }

  delete(id: string): { success: boolean; message?: string } {
    const index = store.workspaces.findIndex((workspace) => workspace.id === id);
    if (index < 0) {
      return { success: false, message: '工作区不存在' };
    }
    const [workspace] = store.workspaces.splice(index, 1);
    try {
      if (existsSync(workspace.path)) {
        rmSync(workspace.path, { recursive: true, force: true });
      }
    } catch (err) {
      pushLog('workspace', `磁盘清理失败：${workspace.name} — ${(err as Error).message}`, LogLevel.WARN);
    }
    saveWorkspaces(store.workspaces);
    pushLog('workspace', `工作区已删除：${workspace.name}`);
    return { success: true };
  }

  rename(id: string, name: string): { success: boolean; message?: string } {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, message: '名称不能为空' };
    }
    const workspace = store.workspaces.find((ws) => ws.id === id);
    if (!workspace) {
      return { success: false, message: '工作区不存在' };
    }
    const oldPath = workspace.path;
    const newDirName = nameToDirName(trimmedName);
    const newPath = resolve(WORKSPACE_DIR, newDirName);
    try {
      if (existsSync(oldPath) && oldPath !== newPath) {
        if (existsSync(newPath)) {
          rmSync(newPath, { recursive: true, force: true });
        }
        renameSync(oldPath, newPath);
      }
    } catch (err) {
      pushLog('workspace', `磁盘重命名失败：${workspace.name} — ${(err as Error).message}`, LogLevel.WARN);
    }
    workspace.name = trimmedName;
    workspace.path = newPath;
    workspace.updatedAt = new Date().toISOString();
    saveWorkspaces(store.workspaces);
    pushLog('workspace', `工作区已重命名：${workspace.name}`);
    return { success: true };
  }

  export(id: string): { success: boolean; path?: string; message?: string } {
    const workspace = store.workspaces.find((ws) => ws.id === id);
    if (!workspace) {
      return { success: false, message: '工作区不存在' };
    }
    const agentList = store.agents.filter((agent) => agent.workspaceId === id);
    const exportData = {
      version: '1.0',
      type: 'lubanai-workspace',
      workspace: { name: workspace.name, createdAt: workspace.createdAt },
      agents: agentList,
      exportedAt: new Date().toISOString(),
    };
    if (!existsSync(EXPORTS_DIR)) mkdirSync(EXPORTS_DIR, { recursive: true });
    const exportPath = resolve(EXPORTS_DIR, `workspace-${workspace.id}.json`);
    writeFileSync(exportPath, JSON.stringify(exportData, null, 2), 'utf-8');
    pushLog('workspace', `工作区已导出：${workspace.name}`);
    return { success: true, path: exportPath };
  }

  import(filePath: string): { success: boolean; workspace?: WorkspaceInfo; message?: string } {
    try {
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      if (data.type !== 'lubanai-workspace') {
        return { success: false, message: '无效的工作区文件' };
      }
      const ws = data.workspace;
      if (!ws?.name) {
        return { success: false, message: '工作区名称缺失' };
      }
      ensureWorkspaceDir();
      const dirName = nameToDirName(ws.name);
      const wsPath = resolve(WORKSPACE_DIR, dirName);
      if (!existsSync(wsPath)) {
        mkdirSync(wsPath, { recursive: true });
      }
      const workspace: WorkspaceInfo = {
        id: createId('workspace'),
        name: ws.name,
        path: wsPath,
        createdAt: ws.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.workspaces.unshift(workspace);
      saveWorkspaces(store.workspaces);
      if (Array.isArray(data.agents) && data.agents.length > 0) {
        const importedAgents = data.agents.map((a: any) => ({
          ...a,
          id: createId('agent'),
          workspaceId: workspace.id,
        }));
        store.agents.push(...importedAgents);
        saveAgents(store.agents);
        pushLog('workspace', `导入 ${importedAgents.length} 个 Agent`);
      }
      pushLog('workspace', `工作区已导入：${workspace.name}`);
      return { success: true, workspace };
    } catch {
      return { success: false, message: '文件解析失败' };
    }
  }

  clone(id: string, name: string): { success: boolean; workspace?: WorkspaceInfo; message?: string } {
    const source = store.workspaces.find((ws) => ws.id === id);
    if (!source) {
      return { success: false, message: '源工作区不存在' };
    }
    const trimmedName = name.trim() || `${source.name} 副本`;
    ensureWorkspaceDir();
    const newDirName = nameToDirName(trimmedName);
    const newPath = resolve(WORKSPACE_DIR, newDirName);
    try {
      copyWorkspaceFiles(source.path, newPath);
    } catch (err) {
      pushLog('workspace', `磁盘克隆失败：${source.name} — ${(err as Error).message}`, LogLevel.WARN);
    }
    const newWorkspace: WorkspaceInfo = {
      id: createId('workspace'),
      name: trimmedName,
      path: newPath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.workspaces.unshift(newWorkspace);
    const sourceAgents = store.agents.filter((a) => a.workspaceId === id);
    if (sourceAgents.length > 0) {
      const clonedAgents = sourceAgents.map((a) => ({
        ...a,
        id: createId('agent'),
        name: `${a.name} (副本)`,
        workspaceId: newWorkspace.id,
      }));
      store.agents.push(...clonedAgents);
      saveAgents(store.agents);
    }
    saveWorkspaces(store.workspaces);
    pushLog('workspace', `工作区已克隆：${source.name} -> ${newWorkspace.name}`);
    return { success: true, workspace: newWorkspace };
  }
}
