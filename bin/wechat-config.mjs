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

// Merge an incoming provider object into an existing one.
// Non-models fields (baseUrl, apiKey, api, ...) are updated by incoming.
// The "models" array is MERGED by model id (append + dedup + update), so
// previously saved models inside custom etc. are never dropped.
function mergeProvider(existing, incoming) {
  const out = existing && typeof existing === 'object' ? { ...existing } : {};
  if (!incoming || typeof incoming !== 'object') return out;
  for (const k of Object.keys(incoming)) {
    const iv = incoming[k];
    const ev = out[k];
    if (k === 'models') {
      if (Array.isArray(iv)) {
        const map = new Map();
        for (const m of (Array.isArray(ev) ? ev : [])) if (m && typeof m === 'object' && m.id != null) map.set(String(m.id), m);
        for (const m of iv) if (m && typeof m === 'object' && m.id != null) map.set(String(m.id), m);
        out[k] = Array.from(map.values());
      } else if (iv && typeof iv === 'object') {
        out[k] = { ...(ev && typeof ev === 'object' && !Array.isArray(ev) ? ev : {}), ...iv };
      } else {
        out[k] = iv;
      }
    } else if (iv && typeof iv === 'object' && !Array.isArray(iv) && ev && typeof ev === 'object' && !Array.isArray(ev)) {
      out[k] = { ...ev, ...iv };
    } else {
      out[k] = iv;
    }
  }
  return out;
}
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
      try {
        const body = await readBody(req);
        const existing = getConfig();
        // Incremental merge: preserve existing providers/agents/channels, upsert the incoming ones.
        if (body.models && typeof body.models === 'object') {
          existing.models = existing.models || {};
          existing.models.providers = existing.models.providers || {};
          if (body.models.mode) existing.models.mode = body.models.mode;
          if (body.models.providers && typeof body.models.providers === 'object') {
            for (const name of Object.keys(body.models.providers)) {
              existing.models.providers[name] = mergeProvider(existing.models.providers[name], body.models.providers[name]);
            }
          }
        }
        // Set the newly selected model as the default active primary, keeping other agent config.
        if (body.agents && body.agents.defaults && body.agents.defaults.model && body.agents.defaults.model.primary) {
          existing.agents = existing.agents || {};
          existing.agents.defaults = existing.agents.defaults || {};
          existing.agents.defaults.model = existing.agents.defaults.model || {};
          existing.agents.defaults.model.primary = body.agents.defaults.model.primary;
        }
        // Merge remaining top-level keys (channels, gateway, commands, plugins, etc.), preserving other keys.
        for (const k of Object.keys(body)) {
          if (k === 'models' || k === 'agents') continue;
          const v = body[k];
          if (v && typeof v === 'object' && !Array.isArray(v) && existing[k] && typeof existing[k] === 'object' && !Array.isArray(existing[k])) {
            existing[k] = { ...existing[k], ...v };
          } else {
            existing[k] = v;
          }
        }
        saveConfig(existing);
        json({ ok: true });
      }
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
