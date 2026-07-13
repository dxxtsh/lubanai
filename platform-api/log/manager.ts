import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import { LogEntry } from '../../shared/types.js';
import { store } from '../store.js';

export class LogManager {
  register(): void {
    ipcMain.handle(IPC_CHANNELS.LOG_READ, async (_e, module?: string, lines = 100) =>
      this.read(module, lines),
    );
    ipcMain.handle(IPC_CHANNELS.LOG_EXPORT, async (_e, module?: string) => ({
      success: true,
      path: `logs/${module || 'all'}-${Date.now()}.log`,
    }));
  }

  read(module?: string, lines = 100): LogEntry[] {
    return store.logs
      .filter((entry) => !module || module === 'all' || entry.module === module)
      .slice(0, lines);
  }
}
