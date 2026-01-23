const express = require('express');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS proxy for Sentinel-2 COG files
app.get('/sentinel-proxy/cog', (req, res) => {
  // Get the actual S3 URL from query parameter
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).send('Missing url parameter');
  }

  console.log('Proxying request to:', targetUrl);

  // Parse the target URL
  const urlObj = new URL(targetUrl);

  const options = {
    hostname: urlObj.hostname,
    path: urlObj.pathname + urlObj.search,
    method: req.method,
    headers: {}
  };

  // Forward range header if present (important for COG tile requests)
  if (req.headers.range) {
    options.headers['Range'] = req.headers.range;
    console.log('Forwarding Range header:', req.headers.range);
  }

  // Make request to S3
  const proxyReq = https.request(options, (proxyRes) => {
    console.log('S3 Response status:', proxyRes.statusCode);

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');

    // Forward status code
    res.status(proxyRes.statusCode);

    // Forward relevant headers
    if (proxyRes.headers['content-type']) {
      res.setHeader('Content-Type', proxyRes.headers['content-type']);
    }
    if (proxyRes.headers['content-length']) {
      res.setHeader('Content-Length', proxyRes.headers['content-length']);
    }
    if (proxyRes.headers['content-range']) {
      res.setHeader('Content-Range', proxyRes.headers['content-range']);
    }
    if (proxyRes.headers['accept-ranges']) {
      res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
    }

    // Pipe the response
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err);
    res.status(500).send('Proxy error: ' + err.message);
  });

  proxyReq.end();
});

// Handle OPTIONS for CORS preflight
app.options('/sentinel-proxy/*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
  res.status(200).send();
});

// Serve static files from the public directory
app.use(express.static('public'));

// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
