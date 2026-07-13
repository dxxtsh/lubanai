import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import { ProviderConfig } from '../../shared/types.js';
import { createId, pushLog, saveProviders, store } from '../store.js';

export class ProviderManager {
  register(): void {
    ipcMain.handle(IPC_CHANNELS.PROVIDER_LIST, async () => store.providers);
    ipcMain.handle(IPC_CHANNELS.PROVIDER_CREATE, async (_e, data: Partial<ProviderConfig>) => this.create(data));
    ipcMain.handle(IPC_CHANNELS.PROVIDER_UPDATE, async (_e, provider: ProviderConfig) => this.update(provider));
    ipcMain.handle(IPC_CHANNELS.PROVIDER_DELETE, async (_e, id: string) => this.delete(id));
    ipcMain.handle(IPC_CHANNELS.PROVIDER_TEST, async (_e, id: string) => this.test(id));
  }

  create(data: Partial<ProviderConfig>): { success: boolean; provider?: ProviderConfig; message?: string } {
    const now = new Date().toISOString();
    const provider: ProviderConfig = {
      id: createId('prov'),
      name: data.name?.trim() || '新建 Provider',
      type: data.type || 'openai-compatible',
      baseUrl: data.baseUrl?.trim() || '',
      apiKey: data.apiKey || '',
      defaultModel: data.defaultModel?.trim() || '',
      createdAt: now,
      updatedAt: now,
    };
    store.providers.unshift(provider);
    saveProviders(store.providers);
    pushLog('provider', `Provider 已创建：${provider.name}`);
    return { success: true, provider };
  }

  update(provider: ProviderConfig): { success: boolean; provider?: ProviderConfig } {
    const index = store.providers.findIndex((item) => item.id === provider.id);
    if (index < 0) {
      return { success: false };
    }
    provider.updatedAt = new Date().toISOString();
    store.providers[index] = provider;
    saveProviders(store.providers);
    pushLog('provider', `Provider 已更新：${provider.name}`);
    return { success: true, provider };
  }

  delete(id: string): { success: boolean; message?: string } {
    const index = store.providers.findIndex((p) => p.id === id);
    if (index < 0) {
      return { success: false, message: 'Provider 不存在' };
    }
    const [provider] = store.providers.splice(index, 1);
    saveProviders(store.providers);
    pushLog('provider', `Provider 已删除：${provider.name}`);
    return { success: true };
  }

  async test(id: string): Promise<{ success: boolean; message: string }> {
    const provider = store.providers.find((p) => p.id === id);
    if (!provider) {
      return { success: false, message: 'Provider 不存在' };
    }
    if (!provider.baseUrl) {
      return { success: false, message: 'API Base URL 未配置' };
    }
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(`${provider.baseUrl}/models`, {
        signal: controller.signal,
        headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : undefined,
      });
      clearTimeout(timeout);
      if (resp.ok) {
        return { success: true, message: '连接成功' };
      }
      return { success: false, message: `HTTP ${resp.status}: ${resp.statusText}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: msg };
    }
  }
}
