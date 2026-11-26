import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..', '..');

export function getOpenClawRunner() {
  const isWin = process.platform === 'win32';
  const openclawBat = path.join(appRoot, 'OpenClaw.bat');
  const openclawSh = path.join(appRoot, 'openclaw.sh');
  const nodeBin = isWin
    ? path.join(appRoot, 'runtime', 'node.exe')
    : path.join(appRoot, 'runtime', 'bin', 'node');
  const openclawMjs = path.join(appRoot, 'node_modules', 'openclaw', 'openclaw.mjs');

  if (isWin && fs.existsSync(openclawBat)) {
    return { command: openclawBat, argsPrefix: [], shell: true };
  }
  if (!isWin && fs.existsSync(openclawSh)) {
    return { command: openclawSh, argsPrefix: [], shell: true };
  }
  const nodeExec = fs.existsSync(nodeBin) ? nodeBin : 'node';
  return { command: nodeExec, argsPrefix: [openclawMjs], shell: false };
}

function getOpenClawExecCmd(argsStr) {
  const isWin = process.platform === 'win32';
  const openclawBat = path.join(appRoot, 'OpenClaw.bat');
  const openclawSh = path.join(appRoot, 'openclaw.sh');
  const nodeBin = isWin
    ? path.join(appRoot, 'runtime', 'node.exe')
    : path.join(appRoot, 'runtime', 'bin', 'node');
  const openclawMjs = path.join(appRoot, 'node_modules', 'openclaw', 'openclaw.mjs');

  if (isWin && fs.existsSync(openclawBat)) {
    return `"${openclawBat}" ${argsStr}`;
  }
  if (!isWin && fs.existsSync(openclawSh)) {
    return `bash "${openclawSh}" ${argsStr}`;
  }
  const nodeExec = fs.existsSync(nodeBin) ? nodeBin : 'node';
  return `"${nodeExec}" "${openclawMjs}" ${argsStr}`;
}

export function loginWechat() {
  return new Promise((resolve, reject) => {
    const runner = getOpenClawRunner();
    const child = spawn(runner.command, [...runner.argsPrefix, 'channels', 'login', '--channel', 'openclaw-weixin'], {
      cwd: appRoot, stdio: 'inherit', shell: runner.shell,
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
    const cmd = getOpenClawExecCmd('channels status');
    return execSync(cmd, { cwd: appRoot, encoding: 'utf-8', timeout: 15000 });
  } catch { return null; }
}

export function installWechatPlugin() {
  try {
    const cmd = getOpenClawExecCmd('plugins install "@tencent-weixin/openclaw-weixin"');
    execSync(cmd, {
      cwd: appRoot, timeout: 60000, encoding: 'utf-8',
    });
    return true;
  } catch { return false; }
}

export function pluginStatus() {
  try {
    const cmd = getOpenClawExecCmd('plugins list --enabled');
    const out = execSync(cmd, { cwd: appRoot, encoding: 'utf-8', timeout: 10000 });
    return out.includes('openclaw-weixin');
  } catch { return false; }
}
