import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export function hasSupabaseBrowserConfig(): boolean {
  return Boolean(supabase);
}

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

const MEDIA_COOKIE = 'veyra_media';

/** Image tags cannot send an Authorization header, so the media route reads this cookie. */
export function syncMediaCookie(token: string | null): void {
  if (typeof document === 'undefined') return;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  if (!token) {
    document.cookie = `${MEDIA_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    return;
  }
  document.cookie = `${MEDIA_COOKIE}=${token}; Path=/; Max-Age=3600; SameSite=Lax${secure}`;
}
