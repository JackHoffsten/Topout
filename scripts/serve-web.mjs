import https from 'node:https';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import selfsigned from 'selfsigned';

// Local-only HTTPS: production must use a trusted certificate/reverse proxy.
export async function serveWeb({ port = 8443, apiPort = 5080 } = {}) {
  const root = resolve('apps/app/dist');
  const cert = await selfsigned.generate([{ name: 'commonName', value: 'localhost' }], {
    days: 1,
    keySize: 2048,
    extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: 'localhost' }] }],
  });
  const types = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.ttf': 'font/ttf',
  };
  const server = https.createServer({ key: cert.private, cert: cert.cert }, async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const upstream = http.request(
        {
          hostname: '127.0.0.1',
          port: apiPort,
          path: req.url,
          method: req.method,
          headers: { ...req.headers, host: `localhost:${apiPort}`, 'x-forwarded-proto': 'https' },
        },
        (response) => {
          res.writeHead(response.statusCode, response.headers);
          response.pipe(res);
        },
      );
      upstream.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        if (!res.writableEnded) res.end('API unavailable');
      });
      req.pipe(upstream);
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'https://localhost').pathname);
      const file = resolve(root, '.' + pathname);
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      let body;
      try {
        body = await readFile(file);
      } catch {
        if (extname(file)) {
          res.writeHead(404);
          res.end();
          return;
        }
        body = await readFile(resolve(root, 'index.html'));
      }
      res.writeHead(200, {
        'Content-Type': types[extname(file)] ?? 'text/html',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(500);
      res.end('Unable to serve web export');
    }
  });
  await new Promise((resolve) => server.listen(port, 'localhost', resolve));
  console.log(`Topout preview: https://localhost:${port}`);
  return server;
}
if (process.argv[1]?.endsWith('serve-web.mjs')) void serveWeb();
