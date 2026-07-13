import { AgentDefinition } from '../../shared/types.js';
export declare class AgentManager {
    register(): void;
    create(): {
        success: boolean;
        agent: AgentDefinition;
    };
    update(agent: AgentDefinition): {
        success: boolean;
        agent?: AgentDefinition;
    };
    delete(id: string): {
        success: boolean;
    };
    duplicate(id: string): {
        success: boolean;
        agent?: AgentDefinition;
    };
    export(id: string): {
        success: boolean;
        path?: string;
        message?: string;
    };
    import(filePath: string): {
        success: boolean;
        agent?: AgentDefinition;
        message?: string;
    };
}
//# sourceMappingURL=manager.d.ts.map