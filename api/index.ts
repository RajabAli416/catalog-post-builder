import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server';

let app: ReturnType<typeof createApp> | null = null;
let startupError: unknown = null;

try {
  app = createApp();
} catch (error) {
  startupError = error;
}

export default function handler(req: IncomingMessage, res: ServerResponse) {
  if (!app) {
    const message =
      startupError instanceof Error
        ? startupError.stack || startupError.message
        : String(startupError);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: message }));
    return;
  }
  return app(req, res);
}
