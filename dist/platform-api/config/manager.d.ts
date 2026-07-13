import { ConfigEntry, ValidationResult } from '../../shared/types.js';
export declare class ConfigManager {
    register(): void;
    listByCategory(category?: string): ConfigEntry[];
    save(key: string, value: ConfigEntry['value']): {
        success: boolean;
        entry?: ConfigEntry;
    };
    validate(): ValidationResult;
}
//# sourceMappingURL=manager.d.ts.map