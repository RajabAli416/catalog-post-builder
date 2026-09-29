import type { IncomingMessage } from 'node:http';
import { createClient } from '@supabase/supabase-js';

function supabaseServerConfig(): { url: string; anonKey: string } | null {
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function hasSupabaseServerConfig(): boolean {
  return supabaseServerConfig() !== null;
}

export async function userIdFromAuthorizationHeader(
  header: string | undefined
): Promise<string | null> {
  const config = supabaseServerConfig();
  if (!config) {
    throw new Error(
      'SUPABASE_URL and SUPABASE_ANON_KEY are not configured. Add them in Vercel, then redeploy.'
    );
  }
  const value = header || '';
  const token = value.startsWith('Bearer ') ? value.slice('Bearer '.length).trim() : '';
  if (!token) return null;

  const supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  if (!/^[0-9a-f-]{36}$/i.test(data.user.id)) return null;
  return data.user.id;
}

function cookieToken(header: string | undefined, name: string): string {
  if (!header) return '';
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    return decodeURIComponent(trimmed.slice(eq + 1));
  }
  return '';
}

function tokenFromRequestUrl(url: string): string {
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) return '';
  return new URLSearchParams(url.slice(queryIndex + 1)).get('access_token') || '';
}

function isMediaRequest(url: string): boolean {
  const pathOnly = url.split('?')[0];
  return pathOnly === '/api/media' || pathOnly === '/media';
}

export async function userIdFromRequest(req: IncomingMessage): Promise<string | null> {
  const header = req.headers.authorization;
  const fromHeader = await userIdFromAuthorizationHeader(
    Array.isArray(header) ? header[0] : header
  );
  if (fromHeader) return fromHeader;

  const cookieHeader = req.headers.cookie;
  const fromCookie = cookieToken(
    Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader,
    'veyra_media'
  );
  if (fromCookie) {
    const userId = await userIdFromAuthorizationHeader(`Bearer ${fromCookie}`);
    if (userId) return userId;
  }

  const url = req.url || '';
  if (!isMediaRequest(url)) return null;
  const fromQuery = tokenFromRequestUrl(url);
  if (!fromQuery) return null;
  return userIdFromAuthorizationHeader(`Bearer ${fromQuery}`);
}
