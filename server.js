const express = require('express');
const fetch = require('node-fetch');
const app = express();

const TARGET_DOMAIN = process.env.TARGET_DOMAIN;
const RELAY_PATH = (process.env.RELAY_PATH || '/gunners').replace(/\/$/, '') || '/gunners';

app.use(express.raw({ type: '*/*', limit: '100mb' }));

// لاگ برای دیباگ
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.all(`${RELAY_PATH}*`, async (req, res) => {
  if (!TARGET_DOMAIN) {
    return res.status(500).send('TARGET_DOMAIN not set');
  }

  const targetUrl = TARGET_DOMAIN + req.originalUrl;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(TARGET_DOMAIN).host,
        'X-Forwarded-For': req.ip,
      },
      body: ['GET', 'HEAD'].includes(req.method) ? null : req.body,
      redirect: 'manual',
    });

    res.status(response.status);

    // فوروارد همه هدرها به جز بعضی موارد
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase();
      if (!['transfer-encoding', 'content-length', 'connection', 'keep-alive'].includes(lowerKey)) {
        res.setHeader(key, value);
      }
    });

    const buffer = await response.buffer();
    res.send(buffer);

  } catch (error) {
    console.error('Relay Error:', error.message);
    res.status(502).send('Bad Gateway - Relay Error');
  }
});

app.get('/', (req, res) => {
  res.send(`XHTTP Relay فعاله<br>Path: ${RELAY_PATH}<br>Target: ${TARGET_DOMAIN}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Relay listening on ${PORT}`);
});
