import { app, BrowserWindow, Menu, Tray, shell, dialog, ipcMain } from 'electron';
import { spawn, ChildProcess, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import net from 'net';
import { fileURLToPath } from 'url';

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

// Unified OpenClaw CLI entry
const openclawBat = path.join(appRoot, 'OpenClaw.bat');
const hasOpenclawBat = fs.existsSync(openclawBat);

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

// ── Deep Merge Utility ──
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const val = source[key];
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      (result as any)[key] = [...val];
    } else if (typeof val === 'object') {
      const targetVal = (result as any)[key];
      if (targetVal && typeof targetVal === 'object' && !Array.isArray(targetVal) && targetVal !== null) {
        (result as any)[key] = deepMerge(targetVal, val);
      } else {
        (result as any)[key] = val;
      }
    } else {
      (result as any)[key] = val;
    }
  }
  return result;
}

// ── Critical Field Protection (Force Restore) ──
// After any merge, re-read the disk copy and unconditionally restore critical fields.
// These fields are managed by OpenClaw gateway / other system code and must NEVER
// be overwritten or deleted by a partial frontend save.
function protectCriticalFields(merged: Record<string, any>): Record<string, any> {
  try {
    const disk = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // [FORCE] agents.list — user's saved workspace / agent definitions.
    // Frontend only sends agents.defaults; without this, the list is wiped.
    if (disk.agents?.list && Array.isArray(disk.agents.list)) {
      if (!merged.agents) merged.agents = {};
      merged.agents.list = disk.agents.list;
      console.log(`[${APP_NAME}] FORCE-protected agents.list (${merged.agents.list.length} items)`);
    }

    // [FORCE] channels — Telegram, QQ, Feishu, WeCom, WeChat config.
    // Partial save never includes these; always preserve from disk.
    if (disk.channels && Object.keys(disk.channels).length > 0) {
      merged.channels = disk.channels;
      console.log(`[${APP_NAME}] FORCE-protected channels`);
    }

    // [FORCE] plugins — installed plugin definitions managed by OpenClaw CLI.
    if (disk.plugins && Object.keys(disk.plugins).length > 0) {
      merged.plugins = disk.plugins;
      console.log(`[${APP_NAME}] FORCE-protected plugins`);
    }

  } catch { /* Cannot read disk — skip protection */ }
  return merged;
}

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

function cleanupOpenClawState(): void {
  try {
    // Delete .bak file to prevent stale baseline comparison
    const bakPath = `${configPath}.bak`;
    if (fs.existsSync(bakPath)) {
      fs.unlinkSync(bakPath);
      console.log(`[${APP_NAME}] Deleted stale .bak`);
    }
    // Delete config health state to prevent restore from old baseline
    const userDir = process.env.USERPROFILE || process.env.HOME || '';
    if (userDir) {
      const healthPath = path.join(userDir, '.openclaw', 'logs', 'config-health.json');
      if (fs.existsSync(healthPath)) {
        fs.unlinkSync(healthPath);
        console.log(`[${APP_NAME}] Deleted config health state`);
      }
    }
  } catch (e) {
    console.error(`[${APP_NAME}] Failed to cleanup OpenClaw state:`, e);
  }
}

function ensureConfigHasGatewayMode(config: any): void {
  if (!config.gateway || typeof config.gateway !== 'object') {
    config.gateway = {};
  }
  if (!config.gateway.mode || typeof config.gateway.mode !== 'string') {
    config.gateway.mode = 'local';
  }
  if (!config.gateway.auth || typeof config.gateway.auth !== 'object') {
    config.gateway.auth = { token: 'lubanai-disk-token' };
  }
}

function ensureConfigStructure(): void {
  try {
    const config = getConfig();
    const oldMode = config.gateway?.mode;
    const oldAuth = config.gateway?.auth?.token;
    ensureConfigHasGatewayMode(config);
    const changed = config.gateway?.mode !== oldMode || config.gateway?.auth?.token !== oldAuth;
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
            // Deep merge: only update fields present in newConfig,
            // preserving channels (Telegram, QQ, Feishu, WeCom, WeChat) etc.
            const merged = deepMerge(existing, newConfig);
            // Restore critical fields that must never be lost by partial save
            const safe = protectCriticalFields(merged);
            // Always ensure gateway.mode is present to prevent
            // OpenClaw gateway's auto-recovery from restoring backup
            ensureConfigHasGatewayMode(safe);
            fs.writeFileSync(configPath, JSON.stringify(safe, null, 2), 'utf-8');
            console.log(`[${APP_NAME}] Config saved (partial merge)`);
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

      // WeChat endpoints (via OpenClaw.bat)
      if (url.pathname === '/api/wechat/login' && req.method === 'POST') {
        try {
          const child = spawn(openclawBat, ['channels', 'login', '--channel', 'openclaw-weixin'], {
            cwd: appRoot, stdio: 'inherit', shell: true,
          });
          await new Promise<void>((resolve, reject) => {
            child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`login exited with code ${code}`)));
            child.on('error', reject);
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e: any) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
      }
      if (url.pathname === '/api/wechat/channel-status' && req.method === 'GET') {
        try {
          const out = execSync(`"${openclawBat}" channels status`, { cwd: appRoot, encoding: 'utf-8', timeout: 15000 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ online: out.toLowerCase().includes('online'), status: out }));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ online: false, status: '' }));
        }
        return;
      }
      if (url.pathname === '/api/wechat/install-plugin' && req.method === 'POST') {
        try {
          execSync(`"${openclawBat}" plugins install "@tencent-weixin/openclaw-weixin"`, { cwd: appRoot, timeout: 60000 });
          const cfg = getConfig();
          if (!cfg.plugins) cfg.plugins = {};
          if (!cfg.plugins.entries) cfg.plugins.entries = {};
          cfg.plugins.entries['openclaw-weixin'] = { enabled: true };
          if (!cfg.plugins.allow) cfg.plugins.allow = [];
          if (!cfg.plugins.allow.includes('openclaw-weixin')) cfg.plugins.allow.push('openclaw-weixin');
          fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e: any) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
        return;
      }
      if (url.pathname === '/api/wechat/plugin-status' && req.method === 'GET') {
        try {
          const out = execSync(`"${openclawBat}" plugins list --enabled`, { cwd: appRoot, encoding: 'utf-8', timeout: 10000 });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ installed: out.includes('openclaw-weixin') }));
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ installed: false }));
        }
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
              fs.writeFileSync(target, content as string, 'utf-8');
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
            // Deep merge: preserve existing config, only override imported fields
            const existing = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            const merged = deepMerge(existing, imported);
            // Restore critical fields that must never be lost by partial save
            const safe = protectCriticalFields(merged);
            fs.writeFileSync(configPath, JSON.stringify(safe, null, 2), 'utf-8');
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

    if (!fs.existsSync(openclawBat)) {
      reject(new Error(`OpenClaw.bat not found: ${openclawBat}`));
      return;
    }

    gatewayProcess = spawn(openclawBat, ['gateway', 'run', '--allow-unconfigured', '--force', '--port', String(port)], {
      cwd: appRoot, shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, OPENCLAW_HOME: appRoot, OPENCLAW_STATE_DIR: configDir, OPENCLAW_CONFIG_PATH: configPath, OPENCLAW_EMBEDDED_IN: APP_NAME, OPENCLAW_DISABLE_BONJOUR: '1' },
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
  cleanupOpenClawState();
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
