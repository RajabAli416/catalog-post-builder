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
      <div className="min-h-screen bg-[#FAF9F5] text-[#141413] flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-white border border-[#E2DFD7] p-8">
          <h1 className="font-editorial text-3xl">Atelier Noor</h1>
          <p className="mt-4 text-sm leading-relaxed text-[#57554E]">
            Add <span className="font-mono">VITE_SUPABASE_URL</span> and{' '}
            <span className="font-mono">VITE_SUPABASE_ANON_KEY</span> to the environment, then
            restart the app.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-[#141413] flex items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="max-w-md w-full bg-white border border-[#E2DFD7] p-8 space-y-5"
      >
        <div>
          <p className="text-[11px] font-mono uppercase tracking-wide text-[#78756C]">
            Atelier Noor
          </p>
          <h1 className="font-editorial text-3xl mt-1">
            {mode === 'create' ? 'Create account' : 'Sign in'}
          </h1>
        </div>
        <label className="block text-sm">
          <span className="text-[#57554E]">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1 w-full border border-[#D6D3C9] bg-[#FAF9F5] px-3 py-2 text-sm outline-none focus:border-[#141413]"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[#57554E]">Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full border border-[#D6D3C9] bg-[#FAF9F5] px-3 py-2 text-sm outline-none focus:border-[#141413]"
          />
        </label>
        {error && <p className="text-sm text-[#991B1B]">{error}</p>}
        {notice && <p className="text-sm text-[#57554E]">{notice}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-[#141413] text-white text-sm py-2.5 hover:bg-[#2C2C2A] disabled:opacity-60"
        >
          {busy ? 'Please wait…' : mode === 'create' ? 'Create account' : 'Sign in'}
        </button>
        <button
          type="button"
          className="w-full text-xs text-[#57554E] hover:text-[#141413]"
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
