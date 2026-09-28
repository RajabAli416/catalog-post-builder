import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

interface LoginViewProps {
  onSignedIn: (email: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSignedIn }) => {
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const trimmedEmail = email.trim();
    try {
      if (mode === 'create') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setNotice('Check your email to confirm the account, then sign in.');
          setMode('sign-in');
          return;
        }
        onSignedIn(data.session.user.email || trimmedEmail);
        return;
      }
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) throw signInError;
      if (!data.session) {
        setNotice('Check your email to confirm the account, then sign in.');
        return;
      }
      onSignedIn(data.session.user.email || trimmedEmail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setBusy(false);
    }
  };

  if (!supabase) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center px-6">
        <div className="max-w-md w-full rounded-2xl border border-line bg-card p-8 shadow-sm">
          <h1 className="font-editorial text-4xl text-ink">Veyra</h1>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Add <span className="font-mono">VITE_SUPABASE_URL</span> and{' '}
            <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> to the environment, then
            restart the app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="max-w-md w-full rounded-2xl border border-line bg-card p-8 shadow-sm space-y-5"
      >
        <div>
          <h1 className="font-editorial text-4xl text-ink">Veyra</h1>
          <p className="mt-1 text-sm text-muted">
            {mode === 'create' ? 'Create an account to open your studio.' : 'Sign in to your studio.'}
          </p>
        </div>
        <label className="block text-sm">
          <span className="text-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full border border-line-strong bg-canvas px-3 py-2 text-sm outline-none focus:border-ink"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted">Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full border border-line-strong bg-canvas px-3 py-2 text-sm outline-none focus:border-ink"
          />
        </label>
        {error && <p className="text-sm text-[#991B1B]">{error}</p>}
        {notice && <p className="text-sm text-muted">{notice}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent text-on-accent text-sm py-3 hover:bg-accent-hover disabled:opacity-60"
        >
          {busy ? 'Please wait…' : mode === 'create' ? 'Create account' : 'Sign in'}
        </button>
        <button
          type="button"
          className="w-full text-xs text-muted hover:text-ink"
          onClick={() => {
            setMode((current) => (current === 'create' ? 'sign-in' : 'create'));
            setError(null);
            setNotice(null);
          }}
        >
          {mode === 'create' ? 'Already have an account? Sign in' : 'New here? Create an account'}
        </button>
      </form>
    </div>
  );
};
