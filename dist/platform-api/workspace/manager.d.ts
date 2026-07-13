import { WorkspaceInfo } from '../../shared/types.js';
export declare class WorkspaceManager {
    register(): void;
    create(name: string): {
        success: boolean;
        workspace?: WorkspaceInfo;
        message?: string;
    };
    delete(id: string): {
        success: boolean;
        message?: string;
    };
    rename(id: string, name: string): {
        success: boolean;
        message?: string;
    };
    export(id: string): {
        success: boolean;
        path?: string;
        message?: string;
    };
    import(filePath: string): {
        success: boolean;
        workspace?: WorkspaceInfo;
        message?: string;
    };
    clone(id: string, name: string): {
        success: boolean;
        workspace?: WorkspaceInfo;
        message?: string;
    };
}
//# sourceMappingURL=manager.d.ts.map