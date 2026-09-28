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

export async function userIdFromRequest(req: IncomingMessage): Promise<string | null> {
  const header = req.headers.authorization;
  return userIdFromAuthorizationHeader(Array.isArray(header) ? header[0] : header);
}
