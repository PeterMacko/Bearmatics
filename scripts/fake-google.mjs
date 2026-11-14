// Fake Google for local browser tests: /auth redirects straight back with a code,
// /token returns an unsigned ID token for a fixed test user. Never used on Cloudflare.
import http from 'node:http';
const port = Number(process.argv[2] ?? 4188);
const client = process.env.GOOGLE_CLIENT_ID ?? 'local-test.apps.googleusercontent.com';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/auth') {
      const back = new URL(url.searchParams.get('redirect_uri'));
      back.searchParams.set('code', `code-${url.searchParams.get('login_hint') ?? 'kid'}`);
      back.searchParams.set('state', url.searchParams.get('state'));
      res.writeHead(302, { location: back.toString() }).end();
    } else if (url.pathname === '/token') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        const code = new URLSearchParams(body).get('code') ?? '';
        const sub = `sub-${code}`;
        const token = `${b64({ alg: 'none' })}.${b64({ iss: 'https://accounts.google.com', aud: client, exp: Math.floor(Date.now() / 1000) + 600, sub })}.x`;
        res
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify({ id_token: token }));
      });
    } else res.writeHead(404).end();
  })
  .listen(port);
