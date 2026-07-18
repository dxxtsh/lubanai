import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..', '..');
const configDir = path.join(appRoot, 'config');
const configPath = path.join(configDir, 'openclaw.json');
const openclawCmd = path.join(appRoot, 'node_modules', '.bin', 'openclaw');

function env() {
  return { ...process.env, OPENCLAW_HOME: appRoot, OPENCLAW_CONFIG_PATH: configPath, OPENCLAW_STATE_DIR: configDir };
}

export function loginWechat() {
  return new Promise((resolve, reject) => {
    const child = spawn(openclawCmd, ['channels', 'login', '--channel', 'openclaw-weixin'], {
      cwd: appRoot, env: env(), shell: true, stdio: 'inherit',
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`login exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

export function channelStatus() {
  try {
    return execSync(`"${openclawCmd}" channels status`, { cwd: appRoot, env: env(), encoding: 'utf-8', timeout: 15000 });
  } catch { return null; }
}

export function installWechatPlugin() {
  try {
    execSync(`"${openclawCmd}" plugins install "@alichor/openclaw-weixin"`, {
      cwd: appRoot, env: env(), timeout: 60000, encoding: 'utf-8',
    });
    return true;
  } catch { return false; }
}

export function pluginStatus() {
  try {
    const out = execSync(`"${openclawCmd}" plugins list --enabled`, { cwd: appRoot, env: env(), encoding: 'utf-8', timeout: 10000 });
    return out.includes('openclaw-weixin');
  } catch { return false; }
}
