import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  try {
    const app = createApp();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: typeof app }));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        error: error instanceof Error ? error.stack || error.message : String(error),
      })
    );
  }
}
