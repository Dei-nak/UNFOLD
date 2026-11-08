import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml' };
const files = new Set([
  'index.html',
  ...['main.js', 'ui.js', 'views.js', 'dates.js', 'store.js', 'liquid.js', 'base.css', 'workspace.css', 'desktop.css', 'sidebar-waves.svg', 'live-veil.svg']
    .map(name => 'src/' + name),
]);
const port = Number(process.env.PORT ?? 4173);
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }

  const path = request.url.split('?')[0];
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (!files.has(file)) {
    response.writeHead(404).end();
    return;
  }

  try {
    const content = await readFile(new URL(file, import.meta.url));
    const type = types[file.split('.').at(-1)];
    response.writeHead(200, {
      'Content-Type': type + '; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    }).end(request.method === 'HEAD' ? undefined : content);
  } catch (error) {
    console.error(error.message);
    response.writeHead(500).end();
  }
});

server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? 'Порт ' + port + ' зайнятий. Закрий попередній запуск UNFOLD або задай інший PORT.'
    : error.message);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log('UNFOLD · http://127.0.0.1:' + server.address().port);
});
