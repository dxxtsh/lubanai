import http from 'http';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as Bridge from './lib/openclaw-bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const resourcesPath = path.join(appRoot, 'resources');
const configDir = path.join(appRoot, 'config');
const configPath = path.join(configDir, 'openclaw.json');
const PORT = parseInt(process.env.WECHAT_CONFIG_PORT) || 18801;
const SKIP = ['gateway', '_version', 'lastTouchedVersion', 'lastTouchedAt', 'meta', 'wizard'];

function getConfig() {
  try { return JSON.parse(fs.readFileSync(configPath, 'utf-8')); }
  catch { return { gateway: { auth: { token: 'lubanai-disk-token' }, mode: 'local' } }; }
}
function saveConfig(cfg) { fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf-8'); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

process.on('uncaughtException', e => { console.error('Error:', e.message); });
process.on('unhandledRejection', e => { console.error('Error:', e.message); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const json = (data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };

  if (url.pathname === '/api/config') {
    if (req.method === 'GET') { json(getConfig()); return; }
    if (req.method === 'POST') {
      try { const body = await readBody(req); saveConfig(Object.assign(getConfig(), body)); json({ ok: true }); }
      catch (e) { json({ error: e.message }, 400); }
      return;
    }
  }

  if (url.pathname === '/api/config/import' && req.method === 'POST') {
    try {
      const imported = await readBody(req);
      for (const k of SKIP) delete imported[k];
      const existing = getConfig();
      for (const k of Object.keys(imported)) {
        if (typeof imported[k] === 'object' && imported[k] !== null && !Array.isArray(imported[k])) {
          existing[k] = existing[k] || {};
          Object.assign(existing[k], imported[k]);
        } else existing[k] = imported[k];
      }
      saveConfig(existing);
      json({ ok: true });
    } catch (e) { json({ error: e.message }, 400); }
    return;
  }

  if (url.pathname === '/api/config/export' && req.method === 'GET') {
    const cfg = getConfig();
    for (const k of SKIP) delete cfg[k];
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="lubanai-config.json"' });
    res.end(JSON.stringify(cfg, null, 2));
    return;
  }

  // Skills endpoints
  if (url.pathname === '/api/config/export/skills' && req.method === 'GET') {
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
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="lubanai-skills.json"' });
    res.end(JSON.stringify(files, null, 2));
    return;
  }

  if (url.pathname === '/api/config/import/skills' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const skillsDir = path.join(appRoot, 'skills');
      fs.mkdirSync(skillsDir, { recursive: true });
      let count = 0;
      for (const [fp, content] of Object.entries(body)) {
        const target = path.join(skillsDir, fp);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, 'utf-8');
        count++;
      }
      json({ ok: true, count });
    } catch (e) { json({ error: e.message }, 400); }
    return;
  }

  // WeChat endpoints
  if (url.pathname === '/api/wechat/login' && req.method === 'POST') {
    try {
      await Bridge.loginWechat();
      json({ ok: true });
    } catch (e) { json({ ok: false, error: e.message }, 500); }
    return;
  }

  if (url.pathname === '/api/wechat/channel-status' && req.method === 'GET') {
    const out = Bridge.channelStatus();
    const online = out !== null && out.toLowerCase().includes('online');
    json({ online, status: out || '' });
    return;
  }

  if (url.pathname === '/api/wechat/plugin-status' && req.method === 'GET') {
    json({ installed: Bridge.pluginStatus() });
    return;
  }

  if (url.pathname === '/api/wechat/install-plugin' && req.method === 'POST') {
    const ok = Bridge.installWechatPlugin();
    if (ok) {
      const cfg = getConfig();
      if (!cfg.plugins) cfg.plugins = {};
      if (!cfg.plugins.entries) cfg.plugins.entries = {};
      cfg.plugins.entries['openclaw-weixin'] = { enabled: true };
      if (!cfg.plugins.allow) cfg.plugins.allow = [];
      if (!cfg.plugins.allow.includes('openclaw-weixin')) cfg.plugins.allow.push('openclaw-weixin');
      saveConfig(cfg);
    }
    json({ ok });
    return;
  }

  if (url.pathname === '/api/version' && req.method === 'GET') {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(appRoot, 'node_modules', 'openclaw', 'package.json'), 'utf8'));
      json({ openclaw: pkg.version });
    } catch (e) { json({ error: e.message }, 500); }
    return;
  }

  if (url.pathname === '/api/done' && req.method === 'POST') { json({ ok: true }); return; }

  // Serve Config.html
  const htmlPath = path.join(resourcesPath, 'Config.html');
  if (fs.existsSync(htmlPath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(htmlPath).pipe(res);
  } else { res.writeHead(404); res.end('Not found'); }
});

function tryListen(port) {
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/?step=3`;
    console.log(`Channel config server: ${url}`);
    try { execSync(`start "" "${url}"`, { shell: true }); } catch {}
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < PORT + 10) tryListen(port + 1);
    else { console.error('Failed to start server:', err.message); process.exit(1); }
  });
}
tryListen(PORT);
