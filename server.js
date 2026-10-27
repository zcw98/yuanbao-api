// Yuanbao API gateway — single file, zero dependencies, Node >= 18
// - /v1/*        -> new-api (带用户 token) 或演示模式
// - /api/admin/* -> new-api admin endpoints (自动登录续期)
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

const ROOT = __dirname;
const MAX_BODY = 8 * 1024 * 1024;
const LIMIT_HEADERS = ['connection', 'keep-alive', 'transfer-encoding', 'content-encoding', 'content-length'];

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}
loadEnv(path.join(ROOT, '.env'));

const NEW_API_URL = process.env.NEW_API_URL || 'http://127.0.0.1:3001';
const ADMIN_USER = process.env.ADMIN_USER || 'yuanbao';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const PORT = parseInt(process.env.PORT || '3000', 10);
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || '*';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

const cors = {
  'Access-Control-Allow-Origin': ALLOW_ORIGIN,
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Channel-Id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function sendJson(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': body.length, ...cors });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = []; let len = 0;
    req.on('data', (c) => { len += c.length; if (len > MAX_BODY) { reject(new Error('payload too large')); return; } data.push(c); });
    req.on('end', () => resolve(Buffer.concat(data)));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  const rel = req.url === '/' ? 'index.html' : req.url.replace(/^\/+/, '');
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) return false;
  fs.readFile(file, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'Not Found' });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', ...cors });
    res.end(data);
  });
  return true;
}

/* ---------- new-api admin session (auto refresh) ---------- */
let adminToken = '';
let adminTokenExp = 0;
let adminLoginPromise = null;

async function loginAdmin() {
  const r = await fetch(NEW_API_URL + '/api/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'New-Api-User': '1' },
    body: JSON.stringify({ username: ADMIN_USER, password: ADMIN_PASS }),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error('new-api login failed: HTTP ' + r.status);
  const j = await r.json();
  const tok = j?.data?.access_token;
  if (!tok) throw new Error('new-api login: no access_token');
  adminToken = tok;
  try {
    const payload = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString('utf8'));
    adminTokenExp = (payload.exp || 0) * 1000 - 60000;
  } catch { adminTokenExp = Date.now() + 5 * 60000; }
  return tok;
}

async function getAdminToken() {
  if (adminToken && Date.now() < adminTokenExp) return adminToken;
  if (!adminLoginPromise) {
    adminLoginPromise = loginAdmin().finally(() => { adminLoginPromise = null; });
  }
  return adminLoginPromise;
}

function demoModels(req, res) {
  sendJson(res, 200, { object: 'list', data: [
    { id: 'minimax-m3.1-flash', object: 'model', owned_by: 'yuanbao' },
    { id: 'deepseek-chat', object: 'model', owned_by: 'yuanbao' },
    { id: 'gpt-4o-mini', object: 'model', owned_by: 'yuanbao' },
  ]});
}

async function demoChat(req, res) {
  const b = req.body || {};
  const model = typeof b.model === 'string' ? b.model : 'minimax-m3.1-flash';
  const who = (b.messages || []).map((m) => (m.role === 'assistant' ? 'assistant' : m.role === 'user' ? 'user' : (m.role || 'system')) + ': ' + (m.content || '')).join('\n');
  if (b.stream === true || b.stream === 'true') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', ...cors });
    const id = 'chatcmbot-demo-' + Date.now();
    res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: '这是元宝API 本地演示回复。' }, finish_reason: null }] }) + '\n\n');
    res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: '\n(本地演示模式，未接入上游。)\n收到：' }, finish_reason: null }] }) + '\n\n');
    res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: { content: who ? ('\n' + who) : '' }, finish_reason: null }] }) + '\n\n');
    res.write('data: ' + JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }) + '\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
    return;
  }
  sendJson(res, 200, {
    id: 'chatcmbot-demo-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000),
    model, choices: [{ index: 0, message: { role: 'assistant', content: '这是元宝API 本地演示回复。\n(本地演示模式，未接入上游。)\n收到：\n' + who }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  });
}

/* ---------- 代理到 new-api /v1/*（透传用户 Authorization） ---------- */
async function proxyToNewApi(req, res, raw) {
  const userAuth = req.headers['authorization'] || '';
  const url = NEW_API_URL + '/v1' + req.url.replace(/^\/v1/, '');
  const headers = {
    'Content-Type': req.headers['content-type'] || 'application/json',
  };
  if (userAuth) headers['Authorization'] = userAuth;
  if (req.headers['x-channel-id']) headers['X-Channel-Id'] = req.headers['x-channel-id'];
  const opts = { method: req.method, headers };
  if (raw.length) opts.body = raw;
  opts.signal = AbortSignal.timeout(60000);
  let upstream;
  try { upstream = await fetch(url, opts); } catch (e) {
    const code = e.cause instanceof Error && /timed out|timeout/i.test(e.cause.message) ? 504 : 502;
    return sendJson(res, code, { error: 'new-api unreachable', message: e.message });
  }
  const outHeaders = {};
  for (const [k, v] of upstream.headers.entries()) {
    if (LIMIT_HEADERS.includes(k.toLowerCase())) continue;
    outHeaders[k] = v;
  }
  if (ALLOW_ORIGIN !== '*') outHeaders['Access-Control-Allow-Origin'] = ALLOW_ORIGIN;
  res.writeHead(upstream.status, outHeaders);
  if (upstream.status >= 204 || !upstream.body) { res.end(); return; }
  Readable.from(upstream.body).on('error', () => res.destroy()).pipe(res);
}

/* ---------- 代理到 new-api admin ---------- */
async function proxyAdmin(req, res, raw) {
  let tok;
  try { tok = await getAdminToken(); }
  catch (e) { return sendJson(res, 401, { error: 'new-api login failed', message: e.message }); }
  const u = new URL(req.url, 'http://x').pathname;
  const url = NEW_API_URL + u.replace(/^\/api\/admin/, '/api');
  const headers = {
    'Content-Type': req.headers['content-type'] || 'application/json',
    'Authorization': 'Bearer ' + tok,
    'New-Api-User': '1',
  };
  const opts = { method: req.method, headers };
  if (raw.length) opts.body = raw;
  opts.signal = AbortSignal.timeout(30000);
  let upstream;
  try { upstream = await fetch(url, opts); } catch (e) {
    return sendJson(res, 502, { error: 'new-api unreachable', message: e.message });
  }
  const outHeaders = {};
  for (const [k, v] of upstream.headers.entries()) {
    if (LIMIT_HEADERS.includes(k.toLowerCase())) continue;
    outHeaders[k] = v;
  }
  res.writeHead(upstream.status, outHeaders);
  if (upstream.status >= 204 || !upstream.body) { res.end(); return; }
  Readable.from(upstream.body).on('error', () => res.destroy()).pipe(res);
}

const server = http.createServer(async (req, res) => {
  let raw = Buffer.alloc(0);
  try {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) raw = await readBody(req);
  } catch (e) {
    return sendJson(res, 413, { error: e.message });
  }
  req.body = null;
  const ct = req.headers['content-type'] || '';
  if (ct.includes('application/json') && raw.length) {
    try { req.body = JSON.parse(raw.toString('utf8')); } catch { req.body = null; }
  }

  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

  const u = new URL(req.url, 'http://x').pathname;

  if (u.startsWith('/api/admin/')) return proxyAdmin(req, res, raw);

  if (u === '/v1/models' || u.startsWith('/v1/models/')) {
    if (!req.headers['authorization'] && req.method === 'GET') return demoModels(req, res);
    return proxyToNewApi(req, res, raw);
  }
  if (u === '/v1/chat/completions' || u === '/v1/embeddings') {
    if (!req.headers['authorization']) return demoChat(req, res);
    return proxyToNewApi(req, res, raw);
  }
  if (u === '/v1/health' || u === '/health') {
    return sendJson(res, 200, { status: 'ok', newapi: ADMIN_PASS ? 'auto-login' : 'no-admin-pass' });
  }
  if (u.startsWith('/v1/')) {
    if (!req.headers['authorization']) return sendJson(res, 401, { error: 'Authorization required' });
    return proxyToNewApi(req, res, raw);
  }

  if (serveStatic(req, res)) return;
  sendJson(res, 404, { error: 'Not Found', path: u });
});

server.on('clientError', (err, socket) => { if (!socket.destroyed) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); });
server.listen(PORT, '127.0.0.1', () => console.log(`Yuanbao gateway on http://127.0.0.1:${PORT}  newapi-admin=${ADMIN_PASS ? 'auto-login' : 'off'}`));