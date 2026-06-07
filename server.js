require('dotenv').config();
const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname)));

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

// ── BM25 INDEXING — server side ──
app.post('/api/index-pdf', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { text, pdfId, pdfName } = req.body;
    if (!text || !pdfId) return res.status(400).json({ error: 'Missing text or pdfId' });

    // Split into chunks of ~400 words
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

    // Build TF index for each chunk
    const indexedChunks = chunks.map((chunk, idx) => {
      const chunkWords = tokenize(chunk);
      const tf = {};
      chunkWords.forEach(w => { tf[w] = (tf[w] || 0) + 1; });
      return {
        chunkIndex: idx,
        text: chunk,
        wordCount: chunkWords.length,
        tf,
        pdfId,
        pdfName: pdfName || 'Document'
      };
    });

    res.json({
      success: true,
      totalChunks: indexedChunks.length,
      chunks: indexedChunks
    });

  } catch(e) {
    console.error('Index error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── PDF UPLOAD TO CLOUDINARY ──
app.post('/api/upload-pdf', express.raw({ type: 'application/octet-stream', limit: '25mb' }), async (req, res) => {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;
    const fileName = decodeURIComponent(req.headers['x-file-name'] || 'document.pdf');

    if (!cloudName || !uploadPreset) {
      return res.status(500).json({ error: 'Cloudinary not configured' });
    }

    const boundary = 'ArovonBoundary' + Date.now();
    const fileData = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    const parts = [];

    const addField = (name, value) => {
      parts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
      ));
    };

    addField('upload_preset', uploadPreset);
    addField('resource_type', 'raw');

    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${fileName}"\r\nContent-Type: application/pdf\r\n\r\n`
    ));
    parts.push(fileData);
    parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

    const fullBody = Buffer.concat(parts);

    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${cloudName}/raw/upload`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length
      }
    };

    const cloudRes = await new Promise((resolve, reject) => {
      const cloudReq = https.request(options, (resp) => {
        let data = '';
        resp.on('data', chunk => data += chunk);
        resp.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch(e) { reject(new Error('Cloudinary response error: ' + data)); }
        });
      });
      cloudReq.on('error', reject);
      cloudReq.write(fullBody);
      cloudReq.end();
    });

    if (cloudRes.error) {
      return res.status(400).json({ error: cloudRes.error.message || 'Cloudinary rejected upload' });
    }

    res.json({ url: cloudRes.secure_url, publicId: cloudRes.public_id });

  } catch(e) {
    console.error('Upload error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ── BM25 SEARCH — server side ──
app.post('/api/search', express.json(), async (req, res) => {
  try {
    const { query, chunks } = req.body;
    if (!query || !chunks || !chunks.length) {
      return res.json({ results: [] });
    }

    const queryTerms = tokenize(query);
    if (!queryTerms.length) return res.json({ results: [] });

    const N = chunks.length;
    const k1 = 1.5;
    const b = 0.75;

    // Average document length
    const avgDL = chunks.reduce((sum, c) => sum + (c.wordCount || 100), 0) / N;

    // IDF for each query term
    const idf = {};
    queryTerms.forEach(term => {
      const docsWithTerm = chunks.filter(c => c.tf && c.tf[term] > 0).length;
      idf[term] = Math.log((N - docsWithTerm + 0.5) / (docsWithTerm + 0.5) + 1);
    });

    // BM25 score for each chunk
    const scored = chunks.map(chunk => {
      let score = 0;
      const dl = chunk.wordCount || 100;
      queryTerms.forEach(term => {
        const tf = (chunk.tf && chunk.tf[term]) ? chunk.tf[term] : 0;
        if (tf > 0) {
          const numerator = tf * (k1 + 1);
          const denominator = tf + k1 * (1 - b + b * (dl / avgDL));
          score += idf[term] * (numerator / denominator);
        }
      });
      return { ...chunk, score };
    });

    // Sort by score, return top 3
    const results = scored
      .filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    res.json({ results });

  } catch(e) {
    console.error('Search error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── TOKENIZER ──
function tokenize(text) {
  const stopWords = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'is','are','was','were','be','been','have','has','had','do','does','did',
    'will','would','could','should','may','might','shall','can','this','that',
    'these','those','i','you','he','she','it','we','they','my','your','his',
    'her','its','our','their','what','which','who','how','when','where','why',
    'ka','ki','ke','hai','hain','tha','thi','the','ko','se','me','mein','ne',
    'kya','aur','ya','par','jo','jab','woh','yeh','ek','isko','usko','koi',
    'nahi','nhi','bhi','hi','to','ab','phir','ye','wo'
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));
}

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Arovon AI running at http://localhost:' + PORT);
});
