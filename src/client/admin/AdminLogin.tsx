
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../state';
import { Button, Notice, Spinner } from '../components/ui';
import { api } from '../lib/api';

/**
 * Website admin login.
 * Telegram one-time login links continue to work.
 */
export function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const { data } = useApp();
  const navigate = useNavigate();
  const code = new URLSearchParams(window.location.hash.slice(1)).get('code');
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(Boolean(code));
  const [devLogin, setDevLogin] = useState(false);
  const [busy, setBusy] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    api<{ available: boolean }>('/auth/dev-login')
      .then((r) => setDevLogin(r.available))
      .catch(() => {});

    if (!code) return;

    history.replaceState(null, '', '/admin');

    api('/auth/admin-link', { json: { code } })
      .then(() => {
        navigate('/admin', { replace: true });
        onSignedIn();
      })
      .catch((e) => {
        setError(e.message);
        setExchanging(false);
      });
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    try {
      await api('/auth/login', { json: { email, password } });
      onSignedIn();
      navigate('/admin', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل تسجيل الدخول');
    } finally {
      setBusy(false);
    }
  }

  if (exchanging) {
    return <Spinner label="جارٍ تسجيل الدخول…" />;
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-md place-items-center px-6 py-12">
      <div className="w-full space-y-8">
        <div className="text-center">
          <p className="text-muted">{data?.store.name}</p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-3xl font-bold">
            لوحة التحكم
          </h1>
          <p className="mt-2 text-sm text-muted">
            سجّل الدخول لإدارة متجرك
          </p>
        </div>

        {error && <Notice tone="error">{error}</Notice>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">البريد الإلكتروني</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-4 py-2 transition focus:border-ink focus:outline-none"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">كلمة المرور</label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              className="min-h-11 w-full rounded-xl border border-line bg-surface px-4 py-2 transition focus:border-ink focus:outline-none"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" className="w-full" busy={busy}>
            تسجيل الدخول
          </Button>
        </form>

        <div className="flex flex-col gap-3 pt-4">
          <a
            href="/"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-line px-4 py-3 text-sm font-medium transition hover:bg-ink/5"
          >
            العودة إلى الصفحة الرئيسية
          </a>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-line"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-surface px-2 text-muted">أو الدخول عبر</span></div>
          </div>

          <p className="text-center text-xs text-muted">
            يمكنك أيضاً الدخول عبر الرابط المرسل من بوت التيليجرام الخاص بك باستخدام أمر <code className="rounded bg-ink/5 px-1">/admin</code>
          </p>
        </div>

        {devLogin && (
          <div className="space-y-2 border-t border-line pt-5">
            <Button
              variant="plain"
              className="w-full"
              busy={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await api('/auth/dev-login', { json: {} });
                  onSignedIn();
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : 'تعذّر تسجيل الدخول',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              دخول تجريبي (Dev Only)
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

