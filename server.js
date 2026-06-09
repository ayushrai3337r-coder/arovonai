require('dotenv').config();
const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname), { index: false }));

// ── CONFIG ──
app.get('/api/config', (req, res) => {
  res.json({
    firebase: {
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET
    },
    admin: { password: process.env.ADMIN_PASSWORD }
  });
});

// ── BM25 INDEX ──
app.post('/api/index-pdf', express.json({ limit: '10mb' }), (req, res) => {
  try {
    const { text, pdfId, pdfName } = req.body;
    if (!text || !pdfId) return res.status(400).json({ error: 'Missing text or pdfId' });
    const words = text.split(/\s+/);
    const CHUNK_SIZE = 400;
    const OVERLAP = 80;
    const chunks = [];
    for (let i = 0; i < words.length; i += (CHUNK_SIZE - OVERLAP)) {
      const chunk = words.slice(i, i + CHUNK_SIZE).join(' ');
      if (chunk.trim().length < 50) continue;
      chunks.push(chunk.trim());
      if (i + CHUNK_SIZE >= words.length) break;
    }
    const indexedChunks = chunks.map((chunk, idx) => {
      const chunkWords = tokenize(chunk);
      const tf = {};
      chunkWords.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
      return { chunkIndex: idx, text: chunk, wordCount: chunkWords.length, tf, pdfId, pdfName: pdfName || 'Document' };
    });
    res.json({ success: true, totalChunks: indexedChunks.length, chunks: indexedChunks });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── BM25 SEARCH ──
app.post('/api/search', express.json(), (req, res) => {
  try {
    const { query, chunks } = req.body;
    if (!query || !chunks || !chunks.length) return res.json({ results: [] });
    const queryTerms = tokenize(query);
    if (!queryTerms.length) return res.json({ results: [] });
    const N = chunks.length;
    const k1 = 1.5, b = 0.75;
    const avgDL = chunks.reduce((s, c) => s + (c.wordCount || 100), 0) / N;
    const idf = {};
    queryTerms.forEach(term => {
      const df = chunks.filter(c => c.tf && c.tf[term] > 0).length;
      idf[term] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
    });
    const scored = chunks.map(chunk => {
      let score = 0;
      const dl = chunk.wordCount || 100;
      queryTerms.forEach(term => {
        const tf = (chunk.tf && chunk.tf[term]) ? chunk.tf[term] : 0;
        if (tf > 0) score += idf[term] * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgDL)));
      });
      return { ...chunk, score };
    });
    const results = scored.filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
    res.json({ results });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── SMART FORMAT — raw text to structured markdown ──
app.post('/api/format', express.json(), (req, res) => {
  try {
    const { text, query, qtype } = req.body;
    if (!text) return res.json({ formatted: '' });
    const formatted = buildAnswer(text, query || '', qtype || 'general');
    res.json({ formatted });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

function buildAnswer(rawText, query, qtype) {
  // Clean Wikipedia artifacts
  let text = rawText
    .replace(/\[\d+\]/g, '')
    .replace(/={2,}[^=\n]+=+/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/thumb\|[^\n]+\n/g, '')
    .trim();

  const lines = text.split('\n').filter(l => l.trim().length > 5);
  if (!lines.length) return text;

  const title = lines[0].trim();
  const body = lines.slice(1).join('\n').trim();
  const paras = body.split(/\n{2,}/).map(p => p.trim()).filter(p => p.length > 20);

  if (qtype === 'math') return buildMathAnswer(text, query);
  if (qtype === 'person') return buildPersonAnswer(title, paras);
  if (qtype === 'howto') return buildHowToAnswer(title, paras, query);
  if (qtype === 'list') return buildListAnswer(title, paras, query);
  if (qtype === 'compare') return buildCompareAnswer(title, paras, query);
  return buildGeneralAnswer(title, paras, query);
}

function buildGeneralAnswer(title, paras, query) {
  let out = `## ${title}\n\n`;
  if (!paras.length) return out;

  // First para = intro/definition
  out += paras[0] + '\n\n';

  if (paras.length === 1) return out.trim();

  // Rest = key points
  out += `### Key Points\n\n`;
  paras.slice(1, 5).forEach(para => {
    const sentences = splitSentences(para);
    if (sentences.length >= 4 && para.length > 250) {
      sentences.slice(0, 4).forEach(s => { if (s.trim()) out += `- ${s.trim()}\n`; });
      out += '\n';
    } else {
      out += para + '\n\n';
    }
  });

  return out.trim();
}

function buildPersonAnswer(title, paras) {
  let out = `## ${title}\n\n`;
  if (!paras.length) return out;

  out += paras[0] + '\n\n';

  if (paras.length > 1) {
    out += `### Life & Contributions\n\n`;
    paras.slice(1, 4).forEach(p => { out += p + '\n\n'; });
  }

  // Extract dates/facts as bullet points
  const allText = paras.join(' ');
  const facts = extractFacts(allText);
  if (facts.length > 0) {
    out += `### Quick Facts\n\n`;
    facts.slice(0, 6).forEach(f => { out += `- ${f}\n`; });
  }

  return out.trim();
}

function buildHowToAnswer(title, paras, query) {
  let out = `## ${title}\n\n`;
  if (!paras.length) return out;

  out += paras[0] + '\n\n';

  if (paras.length > 1) {
    out += `### How It Works\n\n`;
    const sentences = paras.slice(1, 4).join(' ').split(/(?<=[.!?])\s+/).filter(s => s.length > 20);
    sentences.slice(0, 6).forEach((s, i) => { out += `${i + 1}. ${s.trim()}\n`; });
  }

  return out.trim();
}

function buildListAnswer(title, paras, query) {
  let out = `## ${title}\n\n`;
  if (!paras.length) return out;

  out += paras[0] + '\n\n';

  if (paras.length > 1) {
    out += `### Types & Examples\n\n`;
    paras.slice(1, 5).forEach(p => {
      const sentences = splitSentences(p);
      sentences.slice(0, 3).forEach(s => { if (s.trim()) out += `- ${s.trim()}\n`; });
    });
  }

  return out.trim();
}

function buildCompareAnswer(title, paras, query) {
  let out = `## ${title}\n\n`;
  if (!paras.length) return out;

  out += paras[0] + '\n\n';

  if (paras.length > 1) {
    out += `### Details\n\n`;
    paras.slice(1, 4).forEach(p => { out += p + '\n\n'; });
  }

  return out.trim();
}

function buildMathAnswer(text, query) {
  return `## Solution\n\n${text}\n\n*Note: For step-by-step solutions, please provide the specific equation or problem.*`;
}

function splitSentences(text) {
  return text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(s => s.trim().length > 15);
}

function extractFacts(text) {
  const facts = [];
  const yearMatches = text.match(/(?:born|died|founded|established|created|invented|won|received)[^.]{5,50}\./gi) || [];
  yearMatches.slice(0, 4).forEach(m => facts.push(m.trim()));
  const dateMatches = text.match(/\b\d{4}\b[^.]{10,60}\./g) || [];
  dateMatches.slice(0, 3).forEach(m => { if (!facts.includes(m.trim())) facts.push(m.trim()); });
  return facts;
}

// ── PDF UPLOAD ──
app.post('/api/upload-pdf', express.raw({ type: 'application/octet-stream', limit: '25mb' }), async (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    const fileName = decodeURIComponent(req.headers['x-file-name'] || 'document.pdf');
    if (!cloudName || !uploadPreset) return res.status(500).json({ error: 'Cloudinary not configured' });
    const boundary = 'ArovonBoundary' + Date.now();
    const fileData = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    const parts = [];
    const addField = (name, value) => parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    addField('upload_preset', uploadPreset);
    addField('resource_type', 'raw');
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`));
    parts.push(fileData);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const fullBody = Buffer.concat(parts);
    const cloudRes = await new Promise((resolve, reject) => {
      const r = https.request({
        hostname: 'api.cloudinary.com',
        path: `/v1_1/${cloudName}/raw/upload`,
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': fullBody.length }
      }, resp => {
        let data = '';
        resp.on('data', c => data += c);
        resp.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(new Error(data)); } });
      });
      r.on('error', reject);
      r.write(fullBody);
      r.end();
    });
    if (cloudRes.error) return res.status(400).json({ error: cloudRes.error.message });
    res.json({ url: cloudRes.secure_url, publicId: cloudRes.public_id });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ── TOKENIZER ──
function tokenize(text) {
  const sw = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','this','that','these','those','i','you','he','she','it','we','they','my','your','his','her','its','ka','ki','ke','hai','hain','tha','thi','ko','se','me','mein','ne','kya','aur','ya','par','jo','woh','yeh','ek','nahi','bhi','hi','to','also','from','by','as','not','all','can','may','more','one','two','three','some','other','than','then','there','their','which','who','what','how','when','where','about','into','over','after','such','through','up','its','out','no','so','said','each','she','do','their','time','if','will','way','about','many','then','them','these','so','some','her','would','make','like','him','into','has','two','more','go','see','no','way','could']);
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !sw.has(w));
}

// ── ROUTES ──
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/chat.html', (req, res) => res.sendFile(path.join(__dirname, 'chat.html')));
app.get('/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));
app.use((req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Arovon AI running at http://localhost:' + PORT));
