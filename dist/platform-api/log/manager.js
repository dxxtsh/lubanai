import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants.js';
import { store } from '../store.js';
export class LogManager {
    register() {
        ipcMain.handle(IPC_CHANNELS.LOG_READ, async (_e, module, lines = 100) => this.read(module, lines));
        ipcMain.handle(IPC_CHANNELS.LOG_EXPORT, async (_e, module) => ({
            success: true,
            path: `logs/${module || 'all'}-${Date.now()}.log`,
        }));
    }
    read(module, lines = 100) {
        return store.logs
            .filter((entry) => !module || module === 'all' || entry.module === module)
            .slice(0, lines);
    }
}
//# sourceMappingURL=manager.js.map