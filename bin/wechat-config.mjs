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
