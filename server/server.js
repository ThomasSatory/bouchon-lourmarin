const express = require('express');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(ROOT, 'assets', 'uploads');
const CONTENT_FILE = path.join(DATA_DIR, 'content.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

const PORT = Number(process.env.PORT || 3000);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'bouchon-lourmarin';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;

for (const d of [DATA_DIR, UPLOADS_DIR]) {
  fs.mkdirSync(d, { recursive: true });
}

const DEFAULT_CONTENT = {
  news: [],
  site: {
    photos: {},
    map: {
      address1: '9, rue du Grand Pré',
      address2: '84160 Lourmarin',
      address3: 'Luberon · Provence',
      latitude: 43.7639,
      longitude: 5.3625,
      mapsUrl: 'https://maps.google.com/?q=Le+Bouchon+9+Rue+du+Grand+Pré+Lourmarin',
    },
    contact: {
      phone: '04 90 09 18 16',
      phoneIntl: '+33490091816',
      instagram: 'https://www.instagram.com/bouchonlourmarin/',
      instagramHandle: '@bouchonlourmarin',
    },
    hours: [
      { days: 'Mardi – Jeudi', value: '19h00 – 01h00' },
      { days: 'Vendredi', value: '11h30 – 14h00 · 19h00 – 01h00' },
      { days: 'Samedi', value: '12h00 – 14h00 · 19h00 – 01h00' },
      { days: 'Dimanche & Lundi', value: 'Fermé', closed: true },
    ],
  },
};

async function loadContent() {
  try {
    const raw = await fsp.readFile(CONTENT_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_CONTENT, ...parsed, site: { ...DEFAULT_CONTENT.site, ...(parsed.site || {}) } };
  } catch {
    await fsp.writeFile(CONTENT_FILE, JSON.stringify(DEFAULT_CONTENT, null, 2));
    return structuredClone(DEFAULT_CONTENT);
  }
}

async function saveContent(c) {
  const tmp = CONTENT_FILE + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(c, null, 2));
  await fsp.rename(tmp, CONTENT_FILE);
}

async function loadSessions() {
  try {
    return JSON.parse(await fsp.readFile(SESSIONS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function saveSessions(s) {
  await fsp.writeFile(SESSIONS_FILE, JSON.stringify(s, null, 2));
}

async function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const sessions = await loadSessions();
  sessions[token] = { createdAt: Date.now() };
  await saveSessions(sessions);
  return token;
}

async function validSession(token) {
  if (!token) return false;
  const sessions = await loadSessions();
  const s = sessions[token];
  if (!s) return false;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    delete sessions[token];
    await saveSessions(sessions);
    return false;
  }
  return true;
}

async function destroySession(token) {
  const sessions = await loadSessions();
  delete sessions[token];
  await saveSessions(sessions);
}

const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

async function requireAuth(req, res, next) {
  const ok = await validSession(req.cookies.session);
  if (!ok) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body || {};
  if (typeof password !== 'string' || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    await new Promise(r => setTimeout(r, 600));
    return res.status(401).json({ error: 'invalid_password' });
  }
  const token = await createSession();
  res.cookie('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: SESSION_TTL_MS,
    path: '/',
  });
  res.json({ ok: true });
});

app.post('/api/admin/logout', async (req, res) => {
  if (req.cookies.session) await destroySession(req.cookies.session);
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});

app.get('/api/admin/me', async (req, res) => {
  const ok = await validSession(req.cookies.session);
  res.json({ authenticated: ok });
});

app.get('/api/news', async (_req, res) => {
  const c = await loadContent();
  const visible = c.news
    .filter(n => n.published !== false)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  res.json(visible);
});

app.get('/api/site', async (_req, res) => {
  const c = await loadContent();
  res.json(c.site);
});

app.get('/api/admin/content', requireAuth, async (_req, res) => {
  res.json(await loadContent());
});

app.post('/api/admin/news', requireAuth, async (req, res) => {
  const { title, body, image, date, published } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title_and_body_required' });
  const c = await loadContent();
  const item = {
    id: crypto.randomBytes(8).toString('hex'),
    title: String(title).slice(0, 200),
    body: String(body).slice(0, 5000),
    image: image || null,
    date: date || new Date().toISOString().slice(0, 10),
    published: published !== false,
    createdAt: Date.now(),
  };
  c.news.push(item);
  await saveContent(c);
  res.json(item);
});

app.put('/api/admin/news/:id', requireAuth, async (req, res) => {
  const c = await loadContent();
  const idx = c.news.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  const { title, body, image, date, published } = req.body || {};
  c.news[idx] = {
    ...c.news[idx],
    ...(title !== undefined && { title: String(title).slice(0, 200) }),
    ...(body !== undefined && { body: String(body).slice(0, 5000) }),
    ...(image !== undefined && { image }),
    ...(date !== undefined && { date }),
    ...(published !== undefined && { published: !!published }),
  };
  await saveContent(c);
  res.json(c.news[idx]);
});

app.delete('/api/admin/news/:id', requireAuth, async (req, res) => {
  const c = await loadContent();
  const before = c.news.length;
  c.news = c.news.filter(n => n.id !== req.params.id);
  if (c.news.length === before) return res.status(404).json({ error: 'not_found' });
  await saveContent(c);
  res.json({ ok: true });
});

app.put('/api/admin/site-photos', requireAuth, async (req, res) => {
  const c = await loadContent();
  const photos = req.body && typeof req.body === 'object' ? req.body : {};
  const clean = {};
  for (const [k, v] of Object.entries(photos)) {
    if (typeof v === 'string' && v) clean[String(k).slice(0, 64)] = v.slice(0, 512);
  }
  c.site.photos = clean;
  await saveContent(c);
  res.json(c.site.photos);
});

app.put('/api/admin/site', requireAuth, async (req, res) => {
  const c = await loadContent();
  const { photos, map, contact, hours } = req.body || {};
  if (photos && typeof photos === 'object') c.site.photos = { ...c.site.photos, ...photos };
  if (map && typeof map === 'object') c.site.map = { ...c.site.map, ...map };
  if (contact && typeof contact === 'object') c.site.contact = { ...c.site.contact, ...contact };
  if (Array.isArray(hours)) c.site.hours = hours;
  await saveContent(c);
  res.json(c.site);
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = /^image\/(jpeg|png|webp|avif|gif)$/.test(file.mimetype);
    cb(ok ? null : new Error('invalid_mime'), ok);
  },
});

app.post('/api/admin/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });
  const id = crypto.randomBytes(8).toString('hex');
  const filename = `${Date.now()}-${id}.jpg`;
  const outPath = path.join(UPLOADS_DIR, filename);
  try {
    await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toFile(outPath);
  } catch (e) {
    return res.status(400).json({ error: 'image_processing_failed', detail: e.message });
  }
  res.json({ url: `/assets/uploads/${filename}`, filename });
});

app.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
  next();
});

app.use('/assets/uploads', express.static(UPLOADS_DIR, {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'),
}));

app.use('/assets', express.static(path.join(ROOT, 'assets'), { maxAge: '30d', immutable: true }));
app.use('/css', express.static(path.join(ROOT, 'css'), { maxAge: '30d', immutable: true }));
app.use('/js', express.static(path.join(ROOT, 'js'), { maxAge: '30d', immutable: true }));
app.use('/admin', express.static(path.join(ROOT, 'admin'), { maxAge: '5m' }));

app.get('/', (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});
app.get('/robots.txt', (_req, res) => res.sendFile(path.join(ROOT, 'robots.txt')));
app.get('/sitemap.xml', (_req, res) => res.sendFile(path.join(ROOT, 'sitemap.xml')));

app.use((err, _req, res, _next) => {
  if (err && err.message === 'invalid_mime') {
    return res.status(400).json({ error: 'invalid_mime' });
  }
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file_too_large' });
  }
  console.error(err);
  res.status(500).json({ error: 'server_error' });
});

loadContent().then(() => {
  app.listen(PORT, () => {
    console.log(`Le Bouchon running on :${PORT} — admin password ${ADMIN_PASSWORD === 'bouchon-lourmarin' ? '(default, CHANGE ADMIN_PASSWORD env)' : 'configured'}`);
  });
});
