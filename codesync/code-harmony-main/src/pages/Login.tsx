import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '@/stores/authStore';

type Mode = 'login' | 'signup';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, signup } = useAuthStore();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters.');
        }
        await signup(email, password, name || email.split('@')[0]);
      }
      navigate('/', { replace: true });
    } catch (err: any) {
      const detail =
        err?.data?.message ||
        err?.originalError?.data?.message ||
        err?.message ||
        'Something went wrong';
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute right-1/4 bottom-1/4 w-[400px] h-[400px] rounded-full bg-ai/5 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">CodeSync</h1>
          <p className="text-sm text-muted-foreground mt-1">Collaborative code editor with AI</p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-xl border border-border bg-card p-6 shadow-2xl shadow-primary/5 space-y-4"
        >
          <div>
            <h2 className="text-lg font-semibold text-center mb-1">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-xs text-muted-foreground text-center">
              {mode === 'login'
                ? 'Sign in to continue to your workspace'
                : 'Start collaborating in seconds'}
            </p>
          </div>

          {mode === 'signup' && (
            <div className="space-y-1">
              <Label htmlFor="name" className="text-xs">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                required
                autoComplete="name"
              />
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <Button type="submit" className="w-full h-10" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            {mode === 'login' ? (
              <>
                No account?{' '}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => { setMode('signup'); setError(null); }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have one?{' '}
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => { setMode('login'); setError(null); }}
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </motion.div>
    </div>
  );
};

export default Login;
