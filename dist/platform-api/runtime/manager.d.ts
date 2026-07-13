import { RuntimeResult, RuntimeState } from '../../shared/types.js';
export declare class RuntimeManager {
    register(): void;
    status(): RuntimeState;
    start(): Promise<RuntimeResult>;
    stop(): Promise<RuntimeResult>;
    restart(): Promise<RuntimeResult>;
}
//# sourceMappingURL=manager.d.ts.map