import { createServer } from './server.js';

const PORT = Number(process.env['PORT'] ?? 3001);
const HOST = process.env['HOST'] ?? '0.0.0.0';

const app = createServer();

app.listen(PORT, HOST, () => {
  process.stdout.write(
    `[crawl-service] Listening on http://${HOST}:${PORT}\n`,
  );
});
