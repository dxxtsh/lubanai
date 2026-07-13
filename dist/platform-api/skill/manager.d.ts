import { SkillInfo } from '../../shared/types.js';
export declare class SkillManager {
    register(): void;
    private scanDisk;
    toggle(id: string): {
        success: boolean;
    };
    install(zipPath: string): {
        success: boolean;
        skill?: SkillInfo;
        message?: string;
    };
    remove(id: string): {
        success: boolean;
        message?: string;
    };
}
//# sourceMappingURL=manager.d.ts.map