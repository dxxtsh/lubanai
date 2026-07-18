import http from 'http';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const resourcesPath = path.join(appRoot, 'resources');
const configDir = path.join(appRoot, 'config');
const configPath = path.join(configDir, 'openclaw.json');

function ensureConfig() {
  const userBak = configPath + '.userbak';
  // Backup if has user data
  if (fs.existsSync(configPath)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (Object.keys(cfg).filter(k => k !== 'gateway').length > 0)
        fs.copyFileSync(configPath, userBak);
    } catch {}
  }
  // Restore backup or create from template
  if (!fs.existsSync(configPath)) {
    if (fs.existsSync(userBak)) fs.copyFileSync(userBak, configPath);
    else {
      const template = configPath + '.template';
      if (fs.existsSync(template)) fs.copyFileSync(template, configPath);
      else fs.writeFileSync(configPath, JSON.stringify(
        { gateway: { mode: 'local', auth: { token: 'lubanai-disk-token' } } }, null, 2
      ));
    }
  }
}
function getConfig() {
  ensureConfig();
  try { return JSON.parse(fs.readFileSync(configPath, 'utf-8')); }
  catch { return { gateway: { auth: { token: 'lubanai-disk-token' }, mode: 'local' } }; }
}

function saveConfig(cfg) {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// Fields to skip — gateway is install-specific, version fields cause compat issues
const SKIP_ON_IMPORT = ['gateway', '_version', 'lastTouchedVersion', 'lastTouchedAt', 'meta', 'wizard'];
const SKIP_ON_EXPORT = ['gateway', '_version', 'lastTouchedVersion', 'lastTouchedAt', 'meta', 'wizard'];

const _require = createRequire(fileURLToPath(import.meta.url));
function getQRCodeLib() {
  try { return _require(path.join(appRoot, 'node_modules', 'openclaw', 'node_modules', 'qrcode')); }
  catch { return _require('qrcode'); }
}

const WECHAT_API = 'https://ilinkai.weixin.qq.com';
const WECHAT_BOT_TYPE = '3';
const WECHAT_LOGIN_TTL = 5 * 60000;
const activeWeChatLogins = new Map();

const PORT = parseInt(process.env.WECHAT_CONFIG_PORT) || 18801;

process.on('uncaughtException', (err) => {
  console.error('Error:', err.message);
  console.log('Press Ctrl+C to exit');
});
process.on('unhandledRejection', (err) => {
  console.error('Error:', err.message);
});

async function wechatStart() {
  const res = await fetch(`${WECHAT_API}/ilink/bot/get_bot_qrcode?bot_type=${WECHAT_BOT_TYPE}`);
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

async function wechatStatus(sessionKey) {
  const login = activeWeChatLogins.get(sessionKey);
  if (!login) return { status: 'expired', message: 'Session not found' };
  if (Date.now() - login.startedAt > WECHAT_LOGIN_TTL) {
    activeWeChatLogins.delete(sessionKey);
    return { status: 'expired', message: 'Session expired' };
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 35000);
  try {
    const res = await fetch(
      `${WECHAT_API}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(login.qrcode)}`,
      { headers: { 'iLink-App-ClientVersion': '1' }, signal: ctrl.signal }
    );
    const result = await res.json();
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
    if (result.status === 'scaned_but_redirect') return { status: 'scaned' };
    return { status: result.status || 'wait' };
  } catch (err) {
    if (err.name === 'AbortError') return { status: 'wait' };
    return { status: 'error', message: err.message };
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/api/wechat/start' && req.method === 'POST') {
    try { const r = await wechatStart(); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(r)); }
    catch (err) { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); }
    return;
  }
  if (url.pathname === '/api/wechat/status' && req.method === 'GET') {
    const session = url.searchParams.get('session');
    if (!session) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing session' })); return; }
    try { const r = await wechatStatus(session); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(r)); }
    catch (err) { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); }
    return;
  }
  if (url.pathname === '/api/wechat/cancel' && req.method === 'POST') {
    activeWeChatLogins.clear();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/api/config' && req.method === 'GET') {
    const cfg = getConfig();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(cfg));
    return;
  }
  if (url.pathname === '/api/config' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const existing = getConfig();
      const merged = Object.assign(existing, body);
      saveConfig(merged);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  if (url.pathname === '/api/config/import' && req.method === 'POST') {
    try {
      const imported = await readBody(req);
      // Backup before import
      const bakPath = configPath + '.bak.' + Date.now();
      try { fs.copyFileSync(configPath, bakPath); } catch {}
      // Skip install-specific fields (gateway, version metadata)
      for (const key of SKIP_ON_IMPORT) delete imported[key];
      // Deep merge into existing config
      const existing = getConfig();
      for (const k of Object.keys(imported)) {
        if (typeof imported[k] === 'object' && imported[k] !== null && !Array.isArray(imported[k])) {
          existing[k] = existing[k] || {};
          Object.assign(existing[k], imported[k]);
        } else {
          existing[k] = imported[k];
        }
      }
      saveConfig(existing);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, backup: path.basename(bakPath) }));
    } catch (err) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  if (url.pathname === '/api/config/export/skills' && req.method === 'GET') {
    try {
      const skillsDir = path.join(appRoot, 'skills');
      const files = {};
      if (fs.existsSync(skillsDir)) {
        const walk = (dir, prefix) => {
          for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            const key = prefix ? `${prefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) walk(full, key);
            else if (entry.name !== '.gitkeep') files[key] = fs.readFileSync(full, 'utf-8');
          }
        };
        walk(skillsDir, '');
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="lubanai-skills.json"',
      });
      res.end(JSON.stringify(files, null, 2));
    } catch (err) { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); }
    return;
  }
  if (url.pathname === '/api/config/import/skills' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const skillsDir = path.join(appRoot, 'skills');
      fs.mkdirSync(skillsDir, { recursive: true });
      let count = 0;
      for (const [filePath, content] of Object.entries(body)) {
        const target = path.join(skillsDir, filePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, 'utf-8');
        count++;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, count }));
    } catch (err) { res.writeHead(400); res.end(JSON.stringify({ error: err.message })); }
    return;
  }
  if (url.pathname === '/api/wechat/plugin-status' && req.method === 'GET') {
    const extDir = path.join(configDir, 'extensions', 'openclaw-weixin');
    const hasPlugin = fs.existsSync(path.join(extDir, 'openclaw.plugin.json'));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ installed: hasPlugin }));
    return;
  }
  if (url.pathname === '/api/wechat/install-plugin' && req.method === 'POST') {
    try {
      const openclawMjs = path.join(appRoot, 'node_modules', 'openclaw', 'dist', 'cli.mjs');
      if (fs.existsSync(openclawMjs)) {
        const nodeBin = process.execPath;
        const cmd = `"${nodeBin}" "${openclawMjs}" plugins install "@tencent-weixin/openclaw-weixin"`;
        execSync(cmd, { cwd: appRoot, env: { ...process.env, OPENCLAW_HOME: appRoot, OPENCLAW_CONFIG_PATH: configPath, OPENCLAW_STATE_DIR: configDir }, timeout: 60000 });
        const cfg = getConfig();
        if (!cfg.plugins) cfg.plugins = {};
        if (!cfg.plugins.entries) cfg.plugins.entries = {};
        cfg.plugins.entries['openclaw-weixin'] = { enabled: true };
        saveConfig(cfg);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }
  if (url.pathname === '/api/done' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (url.pathname === '/api/version' && req.method === 'GET') {
    try {
      const ocPkg = path.join(appRoot, 'node_modules', 'openclaw', 'package.json');
      const pkg = JSON.parse(fs.readFileSync(ocPkg, 'utf8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ openclaw: pkg.version }));
    } catch (err) {
      res.writeHead(500); res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === '/api/config/export' && req.method === 'GET') {
    const cfg = getConfig();
    // Only export portable config (skip install-specific fields)
    for (const key of SKIP_ON_EXPORT) delete cfg[key];
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="lubanai-config.json"',
    });
    res.end(JSON.stringify(cfg, null, 2));
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

function openBrowser(url) {
  try {
    if (process.platform === 'win32') execSync(`start "" "${url}"`, { shell: true });
    else if (process.platform === 'darwin') execSync(`open "${url}"`);
    else execSync(`xdg-open "${url}"`);
  } catch {}
}

function tryListen(port) {
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/?step=3`;
    console.log(`Channel config server: ${url}`);
    openBrowser(url);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < PORT + 10) {
      tryListen(port + 1);
    } else {
      console.error('Failed to start server:', err.message);
      process.exit(1);
    }
  });
}
tryListen(PORT);
