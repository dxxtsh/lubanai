import { app, BrowserWindow, Menu, Tray, shell, dialog, ipcMain } from 'electron';
import { spawn, ChildProcess } from 'child_process';
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

// Bundled Node.js runtime (we use this to run the source-built openclaw)
const nodeBin = isPackaged
  ? path.join(process.resourcesPath, 'runtime', 'node.exe')
  : path.join(appRoot, 'runtime', 'node.exe');

// OpenClaw core location (openclaw.mjs)
const openclawPath = path.join(appRoot, 'openclaw');
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

    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        gateway: {
          mode: 'local',
          auth: { token: 'lubanai-disk-token' },
        },
      };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
      console.log(`[${APP_NAME}] Created default config at ${configPath}`);
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
    const server = http.createServer((req, res) => {
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

    const env = {
      ...process.env,
      OPENCLAW_HOME: appRoot,
      OPENCLAW_STATE_DIR: configDir,
      OPENCLAW_CONFIG_PATH: configPath,
      OPENCLAW_EMBEDDED_IN: APP_NAME,
      NODE_COMPILE_CACHE: compileCacheDir,
      OPENCLAW_DISABLE_BONJOUR: '1', // Disable bonjour mdns discovery on local Windows
    };

    // Run openclaw.mjs via portable Node.js using gateway run command
    gatewayProcess = spawn(nodeBin, [
      openclawMjs,
      'gateway',
      'run',
      '--allow-unconfigured',
      '--force',
      '--port', String(port),
    ], {
      env,
      cwd: openclawPath,
      stdio: ['pipe', 'pipe', 'pipe'],
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

    // Poll for gateway readiness
    const startTime = Date.now();
    const checkReady = () => {
      if (Date.now() - startTime > GATEWAY_STARTUP_TIMEOUT) {
        reject(new Error('Gateway startup timeout'));
        return;
      }

      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        gatewayReady = true;
        gatewayPort = port;
        console.log(`[${APP_NAME}] Gateway ready on port ${port}`);
        resolve(port);
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
    dialog.showErrorBox(
      `${APP_NAME} - 启动失败`,
      `无法启动 OpenClaw 智能体引擎。\n\n错误信息：${err.message}\n\n请检查内核程序或端口占用情况。`
    );
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
