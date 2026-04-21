import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), process.argv[2] ?? 'frontend/dist');
const portValue = process.argv[3] ?? process.env.PORT ?? '4173';
const port = Number.parseInt(portValue, 10);
const host = process.env.HOST ?? '127.0.0.1';

if (!Number.isInteger(port) || port <= 0) {
  throw new Error(`Invalid port: ${portValue}`);
}

const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
]);

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function resolveAssetPath(urlPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const safeRelativePath = decodedPath.replace(/^\/+/, '');
  const candidatePath = path.resolve(distDir, safeRelativePath);
  const relativeCandidatePath = path.relative(distDir, candidatePath);

  if (
    relativeCandidatePath.startsWith('..') ||
    path.isAbsolute(relativeCandidatePath)
  ) {
    return null;
  }

  if (await fileExists(candidatePath)) {
    return candidatePath;
  }

  if (path.extname(candidatePath)) {
    return null;
  }

  const indexPath = path.join(distDir, 'index.html');
  return (await fileExists(indexPath)) ? indexPath : null;
}

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Method Not Allowed');
    return;
  }

  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? host}`);
  const assetPath = await resolveAssetPath(requestUrl.pathname);

  if (!assetPath) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
    return;
  }

  const extension = path.extname(assetPath);
  const contentType = mimeTypes.get(extension) ?? 'application/octet-stream';
  const body = request.method === 'HEAD' ? null : await fs.readFile(assetPath);

  response.writeHead(200, {
    'content-type': contentType,
    'cache-control': extension === '.html' ? 'no-store' : 'public, max-age=300',
  });
  response.end(body ?? undefined);
});

server.listen(port, host, () => {
  console.log(`Serving ${distDir} at http://${host}:${port}`);
});
