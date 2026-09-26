import type { IncomingMessage, ServerResponse } from 'node:http';
import { getGeminiConfig } from '../src/server/geminiService';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, hasKey: getGeminiConfig().hasValidKey }));
}
