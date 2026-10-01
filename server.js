const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const DATA_DIR = path.join(__dirname, 'data');
const CACHE_DIR = path.join(__dirname, 'cache', 'images');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

[DATA_DIR, CACHE_DIR, SESSIONS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Default Configuration
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const DEFAULT_CONFIG = {
  acmtBaseUrl: 'https://portalapp.iconpln.co.id/acmt/DisplayBlobServlet1',
  acmtCookie: process.env.ACMT_COOKIE || '',
  targetMonths: ['202610', '202609', '202608', '202607', '202606', '202605'],
  fotoRumahFotoke: '2',
  fotoMeterFotoke: 'null',
  imageSourceMode: 'direct',
  simulatedMode: false,
  concurrencyLimit: 5,
};

function getConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8')) };
    }
  } catch (err) {
    console.error('Error reading config file:', err);
  }
  return DEFAULT_CONFIG;
}

function saveConfig(newConfig) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf-8');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from root directory first, with 'public' as fallback
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

// Explicit route for root to guarantee index.html is loaded
app.get('/', (req, res) => {
  const rootIndex = path.join(__dirname, 'index.html');
  const publicIndex = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  }
  if (fs.existsSync(publicIndex)) {
    return res.sendFile(publicIndex);
  }
  res.status(404).send(`<h3>Berkas index.html belum terunggah di GitHub</h3><p>Daftar berkas di server: ${fs.readdirSync(__dirname).join(', ')}</p>`);
});

// Placeholder SVGs for specific photo states
const PLACEHOLDER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200" viewBox="0 0 160 200" fill="#f8fafc">
  <rect width="100%" height="100%" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="1.5" rx="6"/>
  <rect x="25" y="45" width="110" height="90" rx="6" fill="#e2e8f0" stroke="#94a3b8" stroke-dasharray="3,3"/>
  <path d="M55 95l15-20 20 25 15-15 15 20H55z" fill="#94a3b8"/>
  <circle cx="70" cy="72" r="6" fill="#94a3b8"/>
  <text x="80" y="155" text-anchor="middle" fill="#64748b" font-family="system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5">TIDAK ADA</text>
  <text x="80" y="170" text-anchor="middle" fill="#64748b" font-family="system-ui, sans-serif" font-size="11" font-weight="700" letter-spacing="0.5">FOTO</text>
</svg>`;

const AUTH_NEEDED_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200" viewBox="0 0 160 200" fill="#fffbeb">
  <rect width="100%" height="100%" fill="#fffbeb" stroke="#fcd34d" stroke-width="1.5" rx="6"/>
  <circle cx="80" cy="75" r="28" fill="#fef3c7" stroke="#f59e0b" stroke-width="2"/>
  <text x="80" y="85" text-anchor="middle" font-size="26">🔒</text>
  <text x="80" y="135" text-anchor="middle" fill="#b45309" font-family="system-ui, sans-serif" font-size="11" font-weight="700">PERLU LOGIN</text>
  <text x="80" y="152" text-anchor="middle" fill="#b45309" font-family="system-ui, sans-serif" font-size="11" font-weight="700">ACMT PLN</text>
  <text x="80" y="172" text-anchor="middle" fill="#92400e" font-family="system-ui, sans-serif" font-size="9">(Klik Link Tab Baru)</text>
</svg>`;

const TIMEOUT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200" viewBox="0 0 160 200" fill="#fef2f2">
  <rect width="100%" height="100%" fill="#fef2f2" stroke="#fca5a5" stroke-width="1.5" rx="6"/>
  <circle cx="80" cy="75" r="28" fill="#fee2e2" stroke="#ef4444" stroke-width="2"/>
  <text x="80" y="85" text-anchor="middle" font-size="26">⚠️</text>
  <text x="80" y="135" text-anchor="middle" fill="#b91c1c" font-family="system-ui, sans-serif" font-size="11" font-weight="700">KONEKSI TIMEOUT</text>
  <text x="80" y="152" text-anchor="middle" fill="#b91c1c" font-family="system-ui, sans-serif" font-size="10">KE ACMT</text>
  <text x="80" y="172" text-anchor="middle" fill="#7f1d1d" font-family="system-ui, sans-serif" font-size="9">(Coba Mode Browser)</text>
</svg>`;

// Helper: generate realistic demo SVG image for testing/simulation
function generateDemoImage(idpel, blth, type) {
  const isMeter = type === 'meter';
  const bgColor = isMeter ? '#1e293b' : '#334155';
  const label = isMeter ? `METER ${blth}` : 'FOTO RUMAH';
  const stanValue = Math.floor(10000 + (parseInt(idpel.slice(-4)) || 1234) + (parseInt(blth.slice(-2)) || 1) * 187);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="320" viewBox="0 0 240 320">
    <rect width="100%" height="100%" fill="${bgColor}" rx="8"/>
    <rect x="20" y="20" width="200" height="280" fill="#0f172a" rx="6" stroke="#475569" stroke-width="2"/>
    <rect x="40" y="40" width="160" height="60" fill="#020617" rx="4" stroke="#22c55e" stroke-width="1.5"/>
    <text x="120" y="80" text-anchor="middle" fill="#22c55e" font-family="Courier, monospace" font-size="24" font-weight="bold">${stanValue} kWh</text>
    <rect x="40" y="115" width="160" height="130" fill="#1e293b" rx="4"/>
    <text x="120" y="145" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="12">IDPEL: ${idpel}</text>
    <text x="120" y="170" text-anchor="middle" fill="#38bdf8" font-family="sans-serif" font-size="14" font-weight="bold">${label}</text>
    <circle cx="120" cy="210" r="18" fill="#eab308" opacity="0.8"/>
    <text x="120" y="280" text-anchor="middle" fill="#64748b" font-family="sans-serif" font-size="10">SIMULATED ACMT METER</text>
  </svg>`;
}

// Core Photo Fetch & Cache Engine
async function getOrFetchPhoto(idpel, blth, type = 'meter', forceRefresh = false) {
  const config = getConfig();
  const safeIdpel = String(idpel).trim();
  const safeBlth = String(blth).trim();
  const safeType = type === 'rumah' ? 'rumah' : 'meter';

  const cacheFileName = `${safeIdpel}_${safeBlth}_${safeType}.jpg`;
  const emptyMarkerFile = `${safeIdpel}_${safeBlth}_${safeType}.empty`;
  const cacheFilePath = path.join(CACHE_DIR, cacheFileName);
  const emptyMarkerPath = path.join(CACHE_DIR, emptyMarkerFile);

  if (forceRefresh) {
    if (fs.existsSync(cacheFilePath)) fs.unlinkSync(cacheFilePath);
    if (fs.existsSync(emptyMarkerPath)) fs.unlinkSync(emptyMarkerPath);
  }

  // 1. Check empty marker
  if (fs.existsSync(emptyMarkerPath) && !forceRefresh) {
    return { kind: 'svg', content: PLACEHOLDER_SVG, status: 'empty-cached' };
  }

  // 2. Check disk cache
  if (fs.existsSync(cacheFilePath) && !forceRefresh) {
    const stats = fs.statSync(cacheFilePath);
    if (stats.size > 100) {
      return { kind: 'file', filePath: cacheFilePath, contentType: 'image/jpeg', status: 'hit-cache' };
    }
  }

  // 3. Simulated Demo Mode
  if (config.simulatedMode) {
    return { kind: 'svg', content: generateDemoImage(safeIdpel, safeBlth, safeType), status: 'simulated' };
  }

  // 4. Live fetch from ACMT
  try {
    const fotokeVal = safeType === 'rumah'
      ? (config.fotoRumahFotoke || '2')
      : (config.fotoMeterFotoke || 'null');

    const url = new URL(config.acmtBaseUrl || 'https://portalapp.iconpln.co.id/acmt/DisplayBlobServlet1');
    url.searchParams.set('idpel', safeIdpel);
    url.searchParams.set('nomor_meter', 'null');
    url.searchParams.set('fotoke', fotokeVal);
    url.searchParams.set('blth', safeBlth);
    url.searchParams.set('isPhoto', 'null');

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://portalapp.iconpln.co.id/acmt/Main.html',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    };

    if (config.acmtCookie) {
      headers['Cookie'] = config.acmtCookie;
    }

    const response = await fetch(url.toString(), { 
      method: 'GET', 
      headers,
      signal: AbortSignal.timeout(10000) 
    });

    if (!response.ok) {
      // Do not write permanent empty marker on server HTTP errors (403, 500, etc)
      return { kind: 'svg', content: AUTH_NEEDED_SVG, status: `http-${response.status}` };
    }

    const contentType = response.headers.get('content-type') || '';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // If redirected to login HTML page because unauthenticated
    if (contentType.includes('text/html') || buffer.slice(0, 100).toString().includes('<html')) {
      return { kind: 'svg', content: AUTH_NEEDED_SVG, status: 'need-auth' };
    }

    // Truly empty or tiny response (no photo in ACMT database)
    if (buffer.length < 200) {
      fs.writeFileSync(emptyMarkerPath, 'EMPTY', 'utf-8');
      return { kind: 'svg', content: PLACEHOLDER_SVG, status: 'empty-blob' };
    }

    // Valid photo fetched!
    fs.writeFileSync(cacheFilePath, buffer);
    return {
      kind: 'buffer',
      buffer,
      contentType: contentType.includes('image') ? contentType : 'image/jpeg',
      status: 'fetched-live',
    };
  } catch (error) {
    // Network / timeout error - DO NOT write empty marker!
    return { kind: 'svg', content: TIMEOUT_SVG, status: 'error: ' + error.message };
  }
}

// Routes

// 1. Get/Set Configuration
app.get('/api/config', (req, res) => {
  const config = getConfig();
  const maskedConfig = {
    ...config,
    hasCookie: !!config.acmtCookie,
    acmtCookieMasked: config.acmtCookie ? config.acmtCookie.slice(0, 8) + '...' + config.acmtCookie.slice(-6) : '',
  };
  res.json(maskedConfig);
});

app.post('/api/config', (req, res) => {
  try {
    const current = getConfig();
    const updated = { ...current, ...req.body };
    saveConfig(updated);
    res.json({ success: true, message: 'Konfigurasi berhasil disimpan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 1b. Direct Bookmarklet Session Synchronizer (1-Click)
app.post('/api/sync-session', (req, res) => {
  try {
    const { cookie } = req.body;
    if (!cookie) {
      return res.status(400).json({ error: 'Cookie tidak boleh kosong' });
    }
    const current = getConfig();
    current.acmtCookie = cookie;
    current.imageSourceMode = 'proxy'; // Auto-enable proxy when session cookie synced
    saveConfig(current);
    console.log('[SESSION SYNC] ACMT Cookie synced successfully from browser bookmarklet');
    res.json({ success: true, message: 'Cookie sesi ACMT berhasil disinkronkan!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Photo Proxy Endpoint
app.get('/api/photo', async (req, res) => {
  const { idpel, blth, type = 'meter', refresh } = req.query;

  if (!idpel || !blth) {
    return res.status(400).send('Parameter idpel dan blth wajib diisi');
  }

  const result = await getOrFetchPhoto(idpel, blth, type, refresh === 'true');

  res.setHeader('X-Photo-Status', result.status);

  if (result.kind === 'file') {
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.sendFile(result.filePath);
  }

  if (result.kind === 'buffer') {
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    return res.send(result.buffer);
  }

  // SVG placeholder
  res.setHeader('Content-Type', 'image/svg+xml');
  return res.send(result.content);
});

// 3. Batch Prefetch System (In-Memory Worker)
let batchState = {
  isRunning: false,
  total: 0,
  processed: 0,
  currentIdpel: '',
  errors: 0,
  startTime: null,
};

app.get('/api/batch-status', (req, res) => {
  res.json(batchState);
});

app.post('/api/batch-cancel', (req, res) => {
  batchState.isRunning = false;
  res.json({ message: 'Batch dibatalkan' });
});

app.post('/api/batch-prefetch', async (req, res) => {
  const { idpels, blthList, forceRefresh } = req.body;

  if (!Array.isArray(idpels) || idpels.length === 0) {
    return res.status(400).json({ error: 'Daftar IDPEL kosong' });
  }

  if (batchState.isRunning) {
    return res.status(409).json({ error: 'Proses batch sedang berjalan', status: batchState });
  }

  const config = getConfig();
  const months = Array.isArray(blthList) && blthList.length > 0 ? blthList : config.targetMonths;

  const fetchTasks = [];
  for (const idpel of idpels) {
    for (const blth of months) {
      fetchTasks.push({ idpel, blth, type: 'meter' });
    }
    fetchTasks.push({ idpel, blth: months[0], type: 'rumah' });
  }

  batchState = {
    isRunning: true,
    total: fetchTasks.length,
    processed: 0,
    currentIdpel: '',
    errors: 0,
    startTime: Date.now(),
  };

  res.json({ success: true, message: 'Batch prefetch dimulai', totalTasks: fetchTasks.length });

  // Direct internal in-memory execution without HTTP loopback
  (async () => {
    const concurrency = config.concurrencyLimit || 5;
    let index = 0;

    async function worker() {
      while (index < fetchTasks.length && batchState.isRunning) {
        const task = fetchTasks[index++];
        batchState.currentIdpel = task.idpel;

        try {
          await getOrFetchPhoto(task.idpel, task.blth, task.type, forceRefresh);
        } catch (e) {
          batchState.errors++;
        } finally {
          batchState.processed++;
        }
      }
    }

    const workers = Array(Math.min(concurrency, fetchTasks.length)).fill(null).map(worker);
    await Promise.all(workers);
    batchState.isRunning = false;
  })();
});

// 4. Clear Empty Cache Markers
app.post('/api/clear-empty-cache', (req, res) => {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    let count = 0;
    for (const file of files) {
      if (file.endsWith('.empty')) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
        count++;
      }
    }
    res.json({ success: true, message: `Berhasil membersihkan ${count} cache kosong.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Audit Sessions (Save & History)
app.get('/api/audit/sessions', (req, res) => {
  try {
    const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
    const sessions = files
      .map((file) => {
        const content = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, file), 'utf-8'));
        return {
          id: path.basename(file, '.json'),
          timestamp: content.timestamp,
          auditor: content.auditor,
          total: content.total,
          sesuai: content.sesuai,
          tidakSesuai: content.tidakSesuai,
          pending: content.pending,
        };
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/audit/session/:id', (req, res) => {
  try {
    const filePath = path.join(SESSIONS_DIR, `${req.params.id}.json`);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    res.status(404).json({ error: 'Sesi tidak ditemukan' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audit/save', (req, res) => {
  try {
    const { auditor = 'UID SUMUT', records = [] } = req.body;
    const now = new Date();
    const sessionId = `audit_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${now.getTime()}`;

    let sesuai = 0;
    let tidakSesuai = 0;
    let pending = 0;

    records.forEach((r) => {
      if (r.status === 'sesuai') sesuai++;
      else if (r.status === 'salah') tidakSesuai++;
      else pending++;
    });

    const sessionData = {
      id: sessionId,
      timestamp: now.toISOString(),
      auditor,
      total: records.length,
      sesuai,
      tidakSesuai,
      pending,
      records,
    };

    fs.writeFileSync(path.join(SESSIONS_DIR, `${sessionId}.json`), JSON.stringify(sessionData, null, 2), 'utf-8');
    res.json({ success: true, sessionId, message: 'Hasil audit berhasil disimpan dan dikunci ke Database' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint for Railway / Cloud uptime monitors
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Diagnostic endpoint to test live ACMT fetch response
app.get('/api/test-fetch', async (req, res) => {
  const { idpel = '124150382150', blth = '202610' } = req.query;
  const config = getConfig();
  try {
    const url = `${config.acmtBaseUrl}?idpel=${idpel}&nomor_meter=null&fotoke=null&blth=${blth}&isPhoto=null`;
    const startTime = Date.now();
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://portalapp.iconpln.co.id/acmt/Main.html',
    };
    if (config.acmtCookie) headers['Cookie'] = config.acmtCookie;

    const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
    const timeTaken = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || '';
    const buffer = await response.arrayBuffer();

    res.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      contentType,
      sizeBytes: buffer.byteLength,
      timeTakenMs: timeTaken,
      isImage: contentType.includes('image'),
      isHtml: contentType.includes('text/html'),
      previewSnippet: contentType.includes('text') ? Buffer.from(buffer).toString('utf-8').slice(0, 300) : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, name: err.name });
  }
});

// Start Server - Bind to 0.0.0.0 for Railway / Container compatibility
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  METRIK - ACMT Fast Review Dashboard running!`);
  console.log(`  Host: 0.0.0.0:${PORT}`);
  console.log(`====================================================`);
});
