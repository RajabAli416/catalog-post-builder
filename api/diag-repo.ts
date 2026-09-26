import type { IncomingMessage, ServerResponse } from 'node:http';
import { studioRepository } from '../src/server/repository';

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, repo: typeof studioRepository.getState }));
}
