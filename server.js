require('dotenv').config();
const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
app.use(express.json({ limit: '25mb' }));

// Static files serve karo
app.use(express.static(path.join(__dirname), {
  index: false
}));

// Config endpoint
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

// BM25 Index
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

// BM25 Search
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
        if (tf > 0) {
          score += idf[term] * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / avgDL)));
        }
      });
      return { ...chunk, score };
    });

    const results = scored.filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
    res.json({ results });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// PDF Upload to Cloudinary
app.post('/api/upload-pdf', express.raw({ type: 'application/octet-stream', limit: '25mb' }), async (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    const fileName = decodeURIComponent(req.headers['x-file-name'] || 'document.pdf');

    if (!cloudName || !uploadPreset) return res.status(500).json({ error: 'Cloudinary not configured' });

    const boundary = 'ArovonBoundary' + Date.now();
    const fileData = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    const parts = [];

    const addField = (name, value) => {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    };
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

// Tokenizer
function tokenize(text) {
  const sw = new Set(['the','a','an','and','or','but','in','on','at','to','for','of','with','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','this','that','these','those','i','you','he','she','it','we','they','my','your','his','her','its','ka','ki','ke','hai','hain','tha','thi','ko','se','me','mein','ne','kya','aur','ya','par','jo','woh','yeh','ek','nahi','bhi','hi','to']);
  return text.toLowerCase().replace(/[^\w\s]/g,' ').split(/\s+/).filter(w => w.length > 2 && !sw.has(w));
}

// ── SPECIFIC PAGE ROUTES ──
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/index.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});
app.get('/chat.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'chat.html'));
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// 404
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Arovon AI running at http://localhost:' + PORT);
});
