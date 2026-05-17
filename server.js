const express = require('express');
const fetch = require('node-fetch');
const app = express();

const TARGET_DOMAIN = process.env.TARGET_DOMAIN; 
const RELAY_PATH = (process.env.RELAY_PATH || '/api').replace(/\/$/, '') || '/api';
const RELAY_KEY = process.env.RELAY_KEY; 

app.use(express.raw({ type: '*/*', limit: '50mb' }));

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.all(`${RELAY_PATH}*`, async (req, res) => {
  if (!TARGET_DOMAIN) {
    return res.status(500).send('TARGET_DOMAIN تنظیم نشده است');
  }

  if (RELAY_KEY && req.headers['x-relay-key'] !== RELAY_KEY) {
    return res.status(403).send('Forbidden');
  }

  const upstreamPath = req.originalUrl;
  const targetUrl = TARGET_DOMAIN + upstreamPath.replace(RELAY_PATH, '');

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: { ...req.headers, host: new URL(TARGET_DOMAIN).host },
      body: ['GET', 'HEAD'].includes(req.method) ? null : req.body,
      redirect: 'manual',
    });

    res.status(response.status);
    response.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'content-length', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    const buffer = await response.buffer();
    res.send(buffer);
  } catch (error) {
    console.error(error);
    res.status(502).send('Bad Gateway');
  }
});

app.get('/', (req, res) => {
  res.send(`XHTTP Relay فعال است! 🚀<br>Path: ${RELAY_PATH}<br>Target: ${TARGET_DOMAIN || 'تنظیم نشده'}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Relay روی پورت ${PORT} فعال شد`);
});
