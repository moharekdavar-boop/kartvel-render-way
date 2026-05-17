const express = require('express');
const fetch = require('node-fetch');
const app = express();

const TARGET_DOMAIN = process.env.TARGET_DOMAIN?.trim();
const RELAY_PATH = (process.env.RELAY_PATH || '/gunners').trim().replace(/\/$/, '') || '/gunners';

app.use(express.raw({ type: '*/*', limit: '100mb' }));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} | IP: ${req.ip}`);
  next();
});

app.all(`${RELAY_PATH}*`, async (req, res) => {
  if (!TARGET_DOMAIN) {
    return res.status(500).send('TARGET_DOMAIN تنظیم نشده');
  }

  const targetUrl = TARGET_DOMAIN + req.originalUrl;

  try {
    console.log(`Forwarding to: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(TARGET_DOMAIN).host,
        'Accept-Encoding': 'identity',
      },
      // مهم‌ترین خط: فقط برای متدهایی که body دارن، body بفرست
      body: ['GET', 'HEAD'].includes(req.method) ? null : req.body,
      redirect: 'manual',
    });

    res.status(response.status);

    response.headers.forEach((value, key) => {
      const k = key.toLowerCase();
      if (!['transfer-encoding', 'content-length', 'connection', 'keep-alive', 'server'].includes(k)) {
        res.setHeader(key, value);
      }
    });

    const buffer = await response.buffer();
    res.send(buffer);

  } catch (error) {
    console.error('Relay Error:', error.message);
    res.status(502).send(`Relay Error: ${error.message}<br>Target: ${targetUrl}`);
  }
});

app.get('/', (req, res) => {
  res.send(`✅ Relay فعال است<br>Path: ${RELAY_PATH}<br>Target: ${TARGET_DOMAIN}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Relay started on ${PORT}`));
