import { ipcMain } from 'electron';
import { existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'fs';
import { resolve, basename, extname } from 'path';
import { DIRECTORIES, IPC_CHANNELS } from '../../shared/constants.js';
import { LogLevel } from '../../shared/types.js';
import { createId, pushLog, saveSkills, store } from '../store.js';
const SKILLS_DIR = resolve(DIRECTORIES.ROOT || '.', DIRECTORIES.SKILLS);
export class SkillManager {
    register() {
        ipcMain.handle(IPC_CHANNELS.SKILL_LIST, async () => {
            this.scanDisk();
            return store.skills;
        });
        ipcMain.handle(IPC_CHANNELS.SKILL_TOGGLE, async (_e, id) => this.toggle(id));
        ipcMain.handle(IPC_CHANNELS.SKILL_INSTALL, async (_e, zipPath) => this.install(zipPath));
        ipcMain.handle(IPC_CHANNELS.SKILL_REMOVE, async (_e, id) => this.remove(id));
    }
    scanDisk() {
        if (!existsSync(SKILLS_DIR))
            return;
        const entries = readdirSync(SKILLS_DIR).filter((e) => {
            const full = resolve(SKILLS_DIR, e);
            return statSync(full).isDirectory();
        });
        for (const dir of entries) {
            const existing = store.skills.find((s) => s.id === dir);
            if (!existing) {
                store.skills.push({
                    id: dir,
                    name: dir,
                    description: `本地 Skill: ${dir}`,
                    enabled: true,
                    version: '0.1.0',
                    category: 'standard',
                });
            }
        }
    }
    toggle(id) {
        const skill = store.skills.find((item) => item.id === id);
        if (!skill) {
            return { success: false };
        }
        skill.enabled = !skill.enabled;
        saveSkills(store.skills);
        pushLog('skill', `${skill.name} 已${skill.enabled ? '启用' : '禁用'}`);
        return { success: true };
    }
    install(zipPath) {
        const fileName = basename(zipPath).replace(extname(zipPath), '');
        if (!existsSync(zipPath)) {
            return { success: false, message: '文件不存在' };
        }
        if (!existsSync(SKILLS_DIR)) {
            mkdirSync(SKILLS_DIR, { recursive: true });
        }
        const targetDir = resolve(SKILLS_DIR, fileName);
        if (!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
        }
        const id = createId('skill');
        const skill = {
            id,
            name: fileName,
            description: `从 ${fileName} 安装的 Skill`,
            enabled: true,
            version: '0.1.0',
            category: 'standard',
        };
        store.skills.unshift(skill);
        saveSkills(store.skills);
        pushLog('skill', `Skill 已安装：${skill.name}`);
        return { success: true, skill };
    }
    remove(id) {
        const index = store.skills.findIndex((s) => s.id === id);
        if (index < 0) {
            return { success: false, message: 'Skill 不存在' };
        }
        const [skill] = store.skills.splice(index, 1);
        const dir = resolve(SKILLS_DIR, skill.name);
        try {
            if (existsSync(dir)) {
                rmSync(dir, { recursive: true, force: true });
            }
        }
        catch (err) {
            pushLog('skill', `磁盘清理失败：${skill.name} — ${err.message}`, LogLevel.WARN);
        }
        saveSkills(store.skills);
        pushLog('skill', `Skill 已删除：${skill.name}`);
        return { success: true };
    }
}
//# sourceMappingURL=manager.js.map