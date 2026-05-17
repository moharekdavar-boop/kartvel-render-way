const express = require('express');
const https = require('https');
const fetch = require('node-fetch');

const app = express();

const TARGET_DOMAIN = process.env.TARGET_DOMAIN?.trim().replace(/\/$/, '');
const RELAY_PATH = (process.env.RELAY_PATH || '/gunners').trim().replace(/\/$/, '') || '/gunners';

app.use(express.raw({ type: '*/*', limit: '100mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.all(`${RELAY_PATH}*`, async (req, res) => {
  if (!TARGET_DOMAIN) {
    return res.status(500).send('TARGET_DOMAIN تنظیم نشده');
  }

  const targetUrl = TARGET_DOMAIN + req.originalUrl;

  try {
    console.log(`Forwarding to: ${targetUrl}`);

    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      const k = key.toLowerCase();
      if (['host', 'connection', 'keep-alive', 'transfer-encoding', 'content-length'].includes(k)) continue;
      if (k.startsWith('x-nf-') || k.startsWith('x-netlify-')) continue;
      headers.set(k, value);
    }

    // هدر Host مهم
    headers.set('Host', new URL(TARGET_DOMAIN).host);

    const fetchOptions = {
      method: req.method,
      headers: Object.fromEntries(headers),
      redirect: 'manual',
      agent: httpsAgent,
      timeout: 60000
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = req.body;
    }

    const upstream = await fetch(targetUrl, fetchOptions);

    console.log(`Xray Status: ${upstream.status}`);

    const responseHeaders = {};
    for (const [key, value] of upstream.headers) {
      const k = key.toLowerCase();
      if (!['transfer-encoding', 'content-length', 'connection', 'keep-alive'].includes(k)) {
        responseHeaders[key] = value;
      }
    }

    res.status(upstream.status);
    res.set(responseHeaders);

    const buffer = await upstream.buffer();
    console.log(`Response size: ${buffer.length} bytes`);
    res.send(buffer);

  } catch (error) {
    console.error('Relay Error:', error.message);
    res.status(502).send(`Relay Error: ${error.message}`);
  }
});

app.get('/', (req, res) => {
  res.send(`✅ Relay فعال است<br>Path: ${RELAY_PATH}<br>Target: ${TARGET_DOMAIN}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Relay started on port ${PORT}`);
});
