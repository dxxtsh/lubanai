import { ProviderConfig } from '../../shared/types.js';
export declare class ProviderManager {
    register(): void;
    create(data: Partial<ProviderConfig>): {
        success: boolean;
        provider?: ProviderConfig;
        message?: string;
    };
    update(provider: ProviderConfig): {
        success: boolean;
        provider?: ProviderConfig;
    };
    delete(id: string): {
        success: boolean;
        message?: string;
    };
    test(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
//# sourceMappingURL=manager.d.ts.map