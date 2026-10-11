import { URL } from 'node:url';
import console from 'node:console';
import process from 'node:process';
import http from 'node:http';
import next from 'next';
const app = next({ dev: false, hostname: '127.0.0.1', port: Number(new URL(process.env.EX08_BROWSER_BASE_URL).port) });
(async () => {
  await app.prepare();
  const server = http.createServer(app.getRequestHandler());
  server.listen(Number(new URL(process.env.EX08_BROWSER_BASE_URL).port), '127.0.0.1');
  const stop = () => server.close(async () => { await app.close(); process.exit(0); });
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
})().catch(() => { console.error('FAIL compiled Next production startup (private details omitted)'); process.exitCode = 1; });
