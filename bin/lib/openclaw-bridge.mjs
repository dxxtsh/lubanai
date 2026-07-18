import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..', '..');
const openclawBat = path.join(appRoot, 'OpenClaw.bat');

export function loginWechat() {
  return new Promise((resolve, reject) => {
    const child = spawn(openclawBat, ['channels', 'login', '--channel', 'openclaw-weixin'], {
      cwd: appRoot, stdio: 'inherit', shell: true,
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
    return execSync(`"${openclawBat}" channels status`, { cwd: appRoot, encoding: 'utf-8', timeout: 15000 });
  } catch { return null; }
}

export function installWechatPlugin() {
  try {
    execSync(`"${openclawBat}" plugins install "@alichor/openclaw-weixin"`, {
      cwd: appRoot, timeout: 60000, encoding: 'utf-8',
    });
    return true;
  } catch { return false; }
}

export function pluginStatus() {
  try {
    const out = execSync(`"${openclawBat}" plugins list --enabled`, { cwd: appRoot, encoding: 'utf-8', timeout: 10000 });
    return out.includes('openclaw-weixin');
  } catch { return false; }
}
