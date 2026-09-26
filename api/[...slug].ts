import type { IncomingMessage, ServerResponse } from 'node:http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const { createApp } = await import('../server');
    const app = createApp();
    app(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
  }
}
