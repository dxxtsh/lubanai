import { app, BrowserWindow, Menu, Tray, shell, dialog, ipcMain } from 'electron';
import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import net from 'net';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Constants ──
const APP_NAME = '钉哥联盟 AI 智盘';
const DEFAULT_PORT = 18789;
const MAX_PORT = 18799;
const GATEWAY_STARTUP_TIMEOUT = 180000;

// ── Paths ──
const isPackaged = app.isPackaged;
const appRoot = isPackaged ? path.resolve(process.resourcesPath, '..') : path.resolve(__dirname, '..', '..', '..');

// Resource directory (where Config.html and loading.html are placed)
const resourcesPath = isPackaged
  ? path.join(process.resourcesPath, 'resources')
  : path.join(appRoot, 'resources');

// Bundled Node.js runtime (we use this to run the source-built openclaw)
const nodeBin = isPackaged
  ? path.join(process.resourcesPath, 'runtime', 'node.exe')
  : path.join(appRoot, 'runtime', 'node.exe');

// OpenClaw CLI wrapper (bin/openclaw.cmd) for standalone gateway usage
const openclawCmd = path.join(appRoot, 'bin', 'openclaw.cmd');
const hasOpenclawCmd = fs.existsSync(openclawCmd);

// OpenClaw core location (node_modules/openclaw/openclaw.mjs)
const openclawPath = path.join(appRoot, 'node_modules', 'openclaw');
const openclawMjs = path.join(openclawPath, 'openclaw.mjs');

// Portable data paths
const configDir = path.join(appRoot, 'config');
const configPath = path.join(configDir, 'openclaw.json');

// ── State ──
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let gatewayProcess: ChildProcess | null = null;
let gatewayPort = DEFAULT_PORT;
let gatewayReady = false;
let configServerPort: number | null = null;

// ── Config Management ──
function ensureConfig(): void {
  try {
    fs.mkdirSync(configDir, { recursive: true });
    fs.mkdirSync(path.join(appRoot, 'data', 'memory'), { recursive: true });
    fs.mkdirSync(path.join(appRoot, 'data', 'backups'), { recursive: true });

    // Always backup user config on startup
    const userBak = configPath + '.userbak';
    if (fs.existsSync(configPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (Object.keys(cfg).filter(k => k !== 'gateway').length > 0)
          fs.copyFileSync(configPath, userBak);
      } catch {}
    }

    if (!fs.existsSync(configPath)) {
      // Try restoring user backup first
      if (fs.existsSync(userBak)) {
        fs.copyFileSync(userBak, configPath);
        console.log(`[${APP_NAME}] Restored config from backup`);
      } else {
        const templatePath = configPath + '.template';
        if (fs.existsSync(templatePath)) {
          fs.copyFileSync(templatePath, configPath);
          console.log(`[${APP_NAME}] Created config from template`);
        } else {
          const defaultConfig = {
            gateway: { mode: 'local', auth: { token: 'lubanai-disk-token' } },
          };
          fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
          console.log(`[${APP_NAME}] Created default config`);
        }
      }
    }
  } catch (e) {
    console.error(`[${APP_NAME}] Failed to ensure config directory:`, e);
  }
}

function getConfig(): any {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { gateway: { mode: 'local', auth: { token: 'lubanai-disk-token' } } };
  }
}

function ensureConfigStructure(): void {
  try {
    let config = getConfig();
    let changed = false;

    // If config has user data beyond gateway, skip all migrations
    const userKeys = Object.keys(config).filter(k => k !== 'gateway');
    if (userKeys.length > 0) return;

    if (!config.gateway) {
      config.gateway = {};
      changed = true;
    }
    if (!config.gateway.mode) {
      config.gateway.mode = 'local';
      changed = true;
    }
    if (!config.gateway.auth) {
      config.gateway.auth = { token: 'lubanai-disk-token' };
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      console.log(`[${APP_NAME}] Config structure validated/updated`);
    }
  } catch (e) {
    console.error(`[${APP_NAME}] Failed to validate config structure:`, e);
  }
}

function hasModelConfigured(): boolean {
  const config = getConfig();
  if (config.agents?.defaults?.model?.primary) return true;
  if (config.env && Object.keys(config.env).some((k) => k.includes('API_KEY'))) return true;
  if (config.models?.providers && Object.keys(config.models.providers).length > 0) return true;
  if (config.agent?.model) return true;
  return false;
}

function getToken(): string {
  const config = getConfig();
  return config?.gateway?.auth?.token || 'lubanai-disk-token';
}

// ── Port Detection ──
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(): Promise<number> {
  for (let port = DEFAULT_PORT; port <= MAX_PORT; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port in range ${DEFAULT_PORT}-${MAX_PORT}`);
}

// ── WeChat Login ──
const WECHAT_API = 'https://ilinkai.weixin.qq.com';
const WECHAT_BOT_TYPE = '3';
const WECHAT_LOGIN_TTL = 5 * 60000;
const activeWeChatLogins = new Map<string, any>();

function getQRCodeLib() {
  try {
    return _require(path.join(appRoot, 'node_modules', 'openclaw', 'node_modules', 'qrcode'));
  } catch { return _require('qrcode'); }
}

async function wechatStart() {
  const url = `${WECHAT_API}/ilink/bot/get_bot_qrcode?bot_type=${WECHAT_BOT_TYPE}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`QR fetch failed: ${res.status}`);
  const data = await res.json();
  const sessionKey = crypto.randomUUID();
  const qr = getQRCodeLib();
  const qrDataUrl = await qr.toDataURL(data.qrcode_img_content, { scale: 6, margin: 2 });
  activeWeChatLogins.set(sessionKey, {
    qrcode: data.qrcode, qrcodeUrl: qrDataUrl, startedAt: Date.now(), refreshCount: 0,
  });
  return { sessionKey, qrcodeUrl: qrDataUrl };
}

async function wechatStatus(sessionKey: string) {
  const login = activeWeChatLogins.get(sessionKey);
  if (!login) return { status: 'expired', message: 'Session not found' };
  if (Date.now() - login.startedAt > WECHAT_LOGIN_TTL) {
    activeWeChatLogins.delete(sessionKey);
    return { status: 'expired', message: 'Session expired' };
  }
  const url = `${WECHAT_API}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(login.qrcode)}`;
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 35000);
  try {
    const res = await fetch(url, {
      headers: { 'iLink-App-ClientVersion': '1' },
      signal: ctrl.signal,
    });
    const result = await res.json();
    if (result.status !== 'wait') console.log(`[WeChat] status=${result.status}${result.redirect_host ? ` redirect=${result.redirect_host}` : ''}`);
    if (result.status === 'expired') {
      login.refreshCount++;
      if (login.refreshCount > 3) { activeWeChatLogins.delete(sessionKey); return { status: 'expired' }; }
      const qrRes = await fetch(`${WECHAT_API}/ilink/bot/get_bot_qrcode?bot_type=${WECHAT_BOT_TYPE}`);
      const qrData = await qrRes.json();
      const qrLib = getQRCodeLib();
      login.qrcode = qrData.qrcode;
      login.qrcodeUrl = await qrLib.toDataURL(qrData.qrcode_img_content, { scale: 6, margin: 2 });
      login.startedAt = Date.now();
      return { status: 'refreshed', qrcodeUrl: login.qrcodeUrl };
    }
    if (result.status === 'confirmed') {
      activeWeChatLogins.delete(sessionKey);
      return { status: 'confirmed', botId: result.ilink_bot_id, token: result.bot_token, baseUrl: result.baseurl, userId: result.ilink_user_id };
    }
    if (result.status === 'scaned_but_redirect') {
      return { status: 'scaned' };
    }
    return { status: result.status || 'wait' };
  } catch (err: any) {
    if (err.name === 'AbortError') return { status: 'wait' };
    return { status: 'error', message: err.message };
  }
}

async function wechatInstallPlugin() {
  try {
    const cmd = `"${nodeBin}" "${openclawMjs}" plugins install "@tencent-weixin/openclaw-weixin"`;
    execSync(cmd, { cwd: appRoot, env: { ...process.env, OPENCLAW_HOME: appRoot, OPENCLAW_CONFIG_PATH: configPath, OPENCLAW_STATE_DIR: configDir }, timeout: 60000 });
    // Enable plugin in config
    const cfg = getConfig();
    if (!cfg.plugins) cfg.plugins = {};
    if (!cfg.plugins.entries) cfg.plugins.entries = {};
    cfg.plugins.entries['openclaw-weixin'] = { enabled: true };
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
    return { ok: true };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

// ── Mini HTTP Server for Config.html ──
function startConfigServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);

      if (req.method === 'GET' && url.pathname === '/api/config') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(getConfig()));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/config') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const newConfig = JSON.parse(body);
            const existing = getConfig();
            const merged = Object.assign(existing, newConfig);
            fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
            console.log(`[${APP_NAME}] Config saved`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
          } catch (e: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: e.message }));
          }
        });
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/done') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        setTimeout(() => {
          if (mainWindow && gatewayReady) {
            const token = getToken();
            mainWindow.loadURL(`http://127.0.0.1:${gatewayPort}/#token=${token}`);
          }
        }, 500);
        return;
      }

      // WeChat QR login API
      if (url.pathname === '/api/wechat/start' && req.method === 'POST') {
        try {
          const result = await wechatStart();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }
      if (url.pathname === '/api/wechat/status' && req.method === 'GET') {
        const session = url.searchParams.get('session');
        if (!session) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing session' })); return; }
        try {
          const result = await wechatStatus(session);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
        return;
      }
      if (url.pathname === '/api/wechat/cancel' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try { const data = body ? JSON.parse(body) : {}; if (data.session) activeWeChatLogins.delete(data.session); else activeWeChatLogins.clear(); } catch {}
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
        return;
      }
      if (url.pathname === '/api/wechat/install-plugin' && req.method === 'POST') {
        const result = await wechatInstallPlugin();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
      if (url.pathname === '/api/wechat/plugin-status' && req.method === 'GET') {
        const extDir = path.join(configDir, 'extensions', 'openclaw-weixin');
        const hasPlugin = fs.existsSync(path.join(extDir, 'openclaw.plugin.json'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ installed: hasPlugin }));
        return;
      }

      // Skills import/export
      if (url.pathname === '/api/config/export/skills' && req.method === 'GET') {
        try {
          const skillsDir = path.join(appRoot, 'skills');
          const files: Record<string, string> = {};
          if (fs.existsSync(skillsDir)) {
            const walk = (dir: string, prefix: string) => {
              for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, entry.name);
                const key = prefix ? `${prefix}/${entry.name}` : entry.name;
                if (entry.isDirectory()) walk(full, key);
                else if (entry.name !== '.gitkeep') files[key] = fs.readFileSync(full, 'utf-8');
              }
            };
            walk(skillsDir, '');
          }
          res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="lubanai-skills.json"' });
          res.end(JSON.stringify(files, null, 2));
        } catch (e: any) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
        return;
      }
      if (url.pathname === '/api/config/import/skills' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const imported = JSON.parse(body);
            const skillsDir = path.join(appRoot, 'skills');
            fs.mkdirSync(skillsDir, { recursive: true });
            let count = 0;
            for (const [filePath, content] of Object.entries(imported)) {
              const target = path.join(skillsDir, filePath);
              fs.mkdirSync(path.dirname(target), { recursive: true });
              fs.writeFileSync(target, content, 'utf-8');
              count++;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, count }));
          } catch (e: any) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
        });
        return;
      }

      // Config import/export
      if (url.pathname === '/api/config/import' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          try {
            const imported = JSON.parse(body);
            // Skip install-specific fields (gateway, version metadata)
            delete imported.gateway;
            for (const key of ['_version', 'lastTouchedVersion', 'lastTouchedAt', 'meta', 'wizard']) delete imported[key];
            // Backup
            const bakPath = configPath + '.bak.' + Date.now();
            try { fs.copyFileSync(configPath, bakPath); } catch {}
            // Deep merge
            const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            for (const k of Object.keys(imported)) {
              if (typeof imported[k] === 'object' && imported[k] !== null && !Array.isArray(imported[k])) {
                existing[k] = existing[k] || {};
                Object.assign(existing[k], imported[k]);
              } else {
                existing[k] = imported[k];
              }
            }
            fs.writeFileSync(configPath, JSON.stringify(existing, null, 2), 'utf-8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, backup: path.basename(bakPath) }));
          } catch (e: any) { res.writeHead(400); res.end(JSON.stringify({ error: e.message })); }
        });
        return;
      }
      if (url.pathname === '/api/config/export' && req.method === 'GET') {
        try {
          const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          // Only export portable config (skip install-specific fields)
          delete cfg.gateway;
          for (const key of ['_version', 'lastTouchedVersion', 'lastTouchedAt', 'meta', 'wizard']) delete cfg[key];
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Content-Disposition': 'attachment; filename="lubanai-config.json"',
          });
          res.end(JSON.stringify(cfg, null, 2));
        } catch (e: any) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
        return;
      }

      const configHtml = path.join(resourcesPath, 'Config.html');
      if (fs.existsSync(configHtml)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(configHtml).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Config.html not found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      configServerPort = port;
      console.log(`[${APP_NAME}] Config server on http://127.0.0.1:${port}`);
      resolve(port);
    });

    server.on('error', (err) => reject(err));
  });
}

function getConfigURL(): string {
  return `http://127.0.0.1:${configServerPort}/?port=${gatewayPort}`;
}

// ── Gateway Management ──
function startGateway(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    console.log(`[${APP_NAME}] Starting OpenClaw gateway on port ${port}...`);

    if (!fs.existsSync(nodeBin)) {
      reject(new Error(`Node runtime binary not found: ${nodeBin}`));
      return;
    }

    if (!fs.existsSync(openclawMjs)) {
      reject(new Error(`OpenClaw entry file not found: ${openclawMjs}`));
      return;
    }

    const compileCacheDir = path.join(appRoot, 'cache', 'v8-compile-cache');
    try {
      fs.mkdirSync(compileCacheDir, { recursive: true });
    } catch {}

    const localTemp = path.join(appRoot, 'temp');
    try { fs.mkdirSync(localTemp, { recursive: true }); } catch {}

    const env = {
      ...process.env,
      OPENCLAW_HOME: appRoot,
      OPENCLAW_STATE_DIR: configDir,
      OPENCLAW_CONFIG_PATH: configPath,
      OPENCLAW_EMBEDDED_IN: APP_NAME,
      NODE_COMPILE_CACHE: compileCacheDir,
      TMP: localTemp,
      TEMP: localTemp,
      OPENCLAW_DISABLE_BONJOUR: '1',
      OPENCLAW_ALLOW_OLDER_BINARY_DESTRUCTIVE_ACTIONS: '1',
    };

    // Run gateway via bin/openclaw.cmd wrapper (standalone, no system PATH needed)
    const gatewayBin = hasOpenclawCmd ? openclawCmd : nodeBin;
    const gatewayArgs = hasOpenclawCmd
      ? ['gateway', 'run', '--allow-unconfigured', '--force', '--port', String(port)]
      : [openclawMjs, 'gateway', 'run', '--allow-unconfigured', '--force', '--port', String(port)];

    gatewayProcess = spawn(gatewayBin, gatewayArgs, {
      env,
      cwd: openclawPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: hasOpenclawCmd,
    });

    gatewayProcess.stdout?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log(`[OpenClaw] ${msg}`);
    });

    gatewayProcess.stderr?.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[OpenClaw:err] ${msg}`);
    });

    gatewayProcess.on('error', (err) => {
      console.error(`[${APP_NAME}] Gateway process error:`, err);
      reject(err);
    });

    gatewayProcess.on('exit', (code) => {
      console.log(`[${APP_NAME}] Gateway exited with code ${code}`);
      gatewayProcess = null;
      gatewayReady = false;
    });

    // Poll for gateway readiness (HTTP + WebSocket)
    const startTime = Date.now();
    const checkReady = () => {
      if (Date.now() - startTime > GATEWAY_STARTUP_TIMEOUT) {
        reject(new Error('Gateway startup timeout'));
        return;
      }

      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        // HTTP responds - now check WebSocket
        const socket = net.connect(port, '127.0.0.1', () => {
          const upgradeReq = [
            'GET / HTTP/1.1',
            'Host: 127.0.0.1:' + port,
            'Upgrade: websocket',
            'Connection: Upgrade',
            'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
            'Sec-WebSocket-Version: 13',
            '',
            '',
          ].join('\r\n');

          let wsResponded = false;
          socket.write(upgradeReq);
          socket.once('data', (data) => {
            const response = data.toString();
            if (response.includes('101') || response.includes('200')) {
              wsResponded = true;
              socket.destroy();
              gatewayReady = true;
              gatewayPort = port;
              console.log(`[${APP_NAME}] Gateway ready on port ${port}`);
              resolve(port);
            }
          });
          socket.on('error', () => { /* fall through */ });
          setTimeout(() => {
            socket.destroy();
            if (!wsResponded) {
              // HTTP works but WebSocket didn't upgrade - still mark as ready
              gatewayReady = true;
              gatewayPort = port;
              console.log(`[${APP_NAME}] Gateway ready (HTTP only) on port ${port}`);
              resolve(port);
            }
          }, 1000);
        });
        socket.on('error', () => setTimeout(checkReady, 500));
      });

      req.on('error', () => setTimeout(checkReady, 500));
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(checkReady, 500);
      });
    };

    setTimeout(checkReady, 1000);
  });
}

function stopGateway(): void {
  if (gatewayProcess) {
    console.log(`[${APP_NAME}] Stopping gateway...`);
    gatewayProcess.kill('SIGTERM');
    setTimeout(() => {
      if (gatewayProcess) gatewayProcess.kill('SIGKILL');
    }, 5000);
  }
}

// ── Window Management ──
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    title: APP_NAME,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
    },
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  loadAppPage();
}

function loadAppPage(): void {
  if (!mainWindow) return;

  if (gatewayReady) {
    const token = getToken();
    mainWindow.loadURL(`http://127.0.0.1:${gatewayPort}/#token=${token}`);
  } else {
    const loadingHtml = path.join(resourcesPath, 'loading.html');
    mainWindow.loadFile(loadingHtml);
  }
}

function loadConfigPage(): void {
  if (!mainWindow || !gatewayReady || !configServerPort) return;
  mainWindow.loadURL(getConfigURL());
}

// ── Tray ──
function createTray(): void {
  try {
    tray = new Tray(path.join(appRoot, 'assets', 'icon.png'));
    tray.setToolTip(APP_NAME);
    const menu = Menu.buildFromTemplate([
      { label: APP_NAME, enabled: false },
      { type: 'separator' },
      { label: '打开聊天页面', click: () => loadAppPage() },
      { label: '打开配置向导', click: () => loadConfigPage() },
      { label: '打开数据文件夹', click: () => shell.openPath(appRoot) },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() },
    ]);
    tray.setContextMenu(menu);
    tray.on('double-click', () => {
      mainWindow?.show();
      mainWindow?.focus();
    });
  } catch {
    console.warn('Tray icon not loaded.');
  }
}

// ── Menu ──
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: APP_NAME,
      submenu: [
        { label: `关于 ${APP_NAME}`, role: 'about' },
        { type: 'separator' },
        { label: '模型与渠道配置', accelerator: 'CmdOrCtrl+,', click: () => loadConfigPage() },
        { label: '对话主面板', accelerator: 'CmdOrCtrl+D', click: () => loadAppPage() },
        { type: 'separator' },
        { label: '打开数据目录', click: () => shell.openPath(appRoot) },
        { type: 'separator' },
        { label: '退出', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── IPC Handlers ──
function setupIPC(): void {
  ipcMain.handle('get-gateway-status', () => ({
    ready: gatewayReady,
    port: gatewayPort,
    token: getToken(),
    hasModel: hasModelConfigured(),
  }));

  ipcMain.handle('open-dashboard', () => {
    if (mainWindow && gatewayReady) {
      const token = getToken();
      mainWindow.loadURL(`http://127.0.0.1:${gatewayPort}/#token=${token}`);
    }
  });

  ipcMain.handle('open-config', () => loadConfigPage());
}

// ── App Lifecycle ──
app.whenReady().then(async () => {
  console.log(`[${APP_NAME}] starting...`);

  ensureConfig();
  ensureConfigStructure();
  createMenu();
  setupIPC();
  createWindow();
  createTray();

  await startConfigServer();

  try {
    const port = await findAvailablePort();
    await startGateway(port);

    if (hasModelConfigured()) {
      loadAppPage();
    } else {
      console.log(`[${APP_NAME}] No model configured, opening configuration wizard.`);
      loadConfigPage();
    }
  } catch (err: any) {
    console.error(`[${APP_NAME}] Failed to start gateway:`, err);
    const msg = err.message.includes('timeout')
      ? `OpenClaw 网关启动超时（${GATEWAY_STARTUP_TIMEOUT / 1000}秒）。\n\n请检查端口 ${DEFAULT_PORT}-${MAX_PORT} 是否被占用，或内核程序是否异常。`
      : `无法启动 OpenClaw 智能体引擎。\n\n错误信息：${err.message}\n\n请检查内核程序或端口占用情况。`;
    dialog.showErrorBox(`${APP_NAME} - 启动失败`, msg);
  }
});

app.on('window-all-closed', () => {
  stopGateway();
  app.quit();
});

app.on('before-quit', () => {
  stopGateway();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
