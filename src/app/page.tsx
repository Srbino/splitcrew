'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sailboat } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface UserOption {
  id: number;
  name: string;
  boat_name: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'member' | 'admin'>('member');
  const [users, setUsers] = useState<UserOption[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Member form
  const [userId, setUserId] = useState('');
  const [memberPassword, setMemberPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Admin form
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    // Check if app is installed — redirect to setup wizard if not
    fetch('/api/setup')
      .then(r => r.json())
      .then(d => {
        if (d.success && !d.data?.installed) {
          router.replace('/setup');
          return;
        }
        // Load users for login dropdown
        return fetch('/api/auth/users').then(r => r.json());
      })
      .then(d => {
        if (d?.success) setUsers(d.data);
      })
      .catch(() => {});
  }, [router]);

  async function handleMemberLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login_type: 'member',
          user_id: Number(userId),
          password: memberPassword,
          remember_me: rememberMe,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/dashboard');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login_type: 'admin',
          password: adminPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push('/admin');
      } else {
        setError(data.error || 'Login failed');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-muted/50">
      {/* Subtle ocean gradient accent */}
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-info/5 pointer-events-none" />

      <motion.div
        className="relative w-full max-w-[420px]"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        <Card className="border shadow-lg">
          <CardContent className="px-8 py-10 sm:px-10">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <motion.div
                className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: 'spring', damping: 15 }}
              >
                <Sailboat size={32} className="text-primary" />
              </motion.div>
              <h1 className="text-2xl font-bold tracking-tight">SplitCrew</h1>
              <p className="text-sm text-muted-foreground mt-1">Sailing crew management</p>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg mb-5 text-center"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tab switcher */}
            <div className="flex rounded-lg border border-border overflow-hidden mb-6">
              {(['member', 'admin'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex-1 py-2.5 text-center text-sm font-semibold transition-all duration-200 border-none cursor-pointer',
                    tab === t
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:bg-accent',
                  )}
                >
                  {t === 'member' ? 'Crew' : 'Admin'}
                </button>
              ))}
            </div>

            {/* Member login */}
            <AnimatePresence mode="wait">
              {tab === 'member' && (
                <motion.div
                  key="member"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                >
                  {users.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground py-6">
                      No crew members have been added yet.
                      <br />
                      Log in as admin and add users.
                    </div>
                  ) : (
                    <form onSubmit={handleMemberLogin} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="user-select">Select your name</Label>
                        <Select value={userId} onValueChange={setUserId} required>
                          <SelectTrigger id="user-select">
                            <SelectValue placeholder="– select –" />
                          </SelectTrigger>
                          <SelectContent>
                            {users.map(u => (
                              <SelectItem key={u.id} value={String(u.id)}>
                                {u.name} ({u.boat_name || 'no boat'})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="member-password">Password</Label>
                        <Input
                          id="member-password"
                          type="password"
                          value={memberPassword}
                          onChange={e => setMemberPassword(e.target.value)}
                          required
                          placeholder="Enter your password"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="remember"
                          checked={rememberMe}
                          onCheckedChange={v => setRememberMe(v === true)}
                        />
                        <Label htmlFor="remember" className="text-sm text-muted-foreground font-normal cursor-pointer">
                          Remember me for 7 days
                        </Label>
                      </div>
                      <Button type="submit" className="w-full" size="lg" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign in'}
                      </Button>
                    </form>
                  )}
                </motion.div>
              )}

              {tab === 'admin' && (
                <motion.div
                  key="admin"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                >
                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="admin-password">Admin password</Label>
                      <Input
                        id="admin-password"
                        type="password"
                        value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        required
                        placeholder="Enter admin password"
                      />
                    </div>
                    <Button type="submit" className="w-full" size="lg" disabled={loading}>
                      {loading ? 'Signing in...' : 'Sign in as admin'}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
