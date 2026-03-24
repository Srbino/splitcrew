'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    fetch('/api/auth/users')
      .then(r => r.json())
      .then(d => {
        if (d.success) setUsers(d.data);
      })
      .catch(() => {});
  }, []);

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
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'var(--color-bg-subtle)',
        fontFamily: 'var(--font-sans)',
        color: 'var(--color-text)',
      }}
    >
      <div
        style={{
          background: 'var(--color-bg)',
          borderRadius: 'var(--radius-lg)',
          padding: '40px 35px',
          maxWidth: 420,
          width: '100%',
          border: '1px solid var(--color-border)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <img
            src="/img/logo.png"
            alt="Logo"
            style={{ width: 80, height: 80, objectFit: 'contain' }}
          />
        </div>
        <h1
          style={{
            textAlign: 'center',
            marginBottom: 28,
            fontSize: '1.5rem',
            color: 'var(--color-text)',
          }}
        >
          CrewSplit
        </h1>

        {error && (
          <div
            style={{
              background: 'var(--color-danger-subtle)',
              border: '1px solid var(--color-danger)',
              color: 'var(--color-danger)',
              padding: 12,
              borderRadius: 'var(--radius)',
              marginBottom: 18,
              textAlign: 'center',
              fontSize: '0.9rem',
            }}
          >
            {error}
          </div>
        )}

        {/* Tab buttons */}
        <div
          style={{
            display: 'flex',
            marginBottom: 25,
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
          }}
        >
          <button
            onClick={() => setTab('member')}
            style={{
              flex: 1,
              padding: 12,
              textAlign: 'center',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.95rem',
              background: tab === 'member' ? 'var(--color-brand)' : 'var(--color-bg)',
              color: tab === 'member' ? 'var(--color-brand-text)' : 'var(--color-text-secondary)',
              border: 'none',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
          >
            Crew
          </button>
          <button
            onClick={() => setTab('admin')}
            style={{
              flex: 1,
              padding: 12,
              textAlign: 'center',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.95rem',
              background: tab === 'admin' ? 'var(--color-brand)' : 'var(--color-bg)',
              color: tab === 'admin' ? 'var(--color-brand-text)' : 'var(--color-text-secondary)',
              border: 'none',
              transition: 'all 0.2s',
              fontFamily: 'inherit',
            }}
          >
            Admin
          </button>
        </div>

        {/* Member login */}
        {tab === 'member' && (
          <>
            {users.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  color: 'var(--color-text-secondary)',
                  padding: 20,
                  fontSize: '0.9rem',
                }}
              >
                No crew members have been added yet.
                <br />
                Log in as admin and add users.
              </div>
            ) : (
              <form onSubmit={handleMemberLogin}>
                <div style={{ marginBottom: 18 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    Select your name
                  </label>
                  <select
                    value={userId}
                    onChange={e => setUserId(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '1rem',
                      fontFamily: 'inherit',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                    }}
                  >
                    <option value="">– select –</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.boat_name || 'no boat'})
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label
                    style={{
                      display: 'block',
                      marginBottom: 6,
                      fontWeight: 600,
                      fontSize: '0.9rem',
                    }}
                  >
                    Crew password
                  </label>
                  <input
                    type="password"
                    value={memberPassword}
                    onChange={e => setMemberPassword(e.target.value)}
                    required
                    placeholder="Enter shared password"
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius)',
                      fontSize: '1rem',
                      fontFamily: 'inherit',
                      background: 'var(--color-bg)',
                      color: 'var(--color-text)',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 'normal',
                      cursor: 'pointer',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      style={{ width: 'auto', accentColor: 'var(--color-brand)' }}
                    />
                    Remember me for 7 days
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: 12,
                    background: 'var(--color-brand)',
                    color: 'var(--color-brand-text)',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    opacity: loading ? 0.7 : 1,
                  }}
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            )}
          </>
        )}

        {/* Admin login */}
        {tab === 'admin' && (
          <form onSubmit={handleAdminLogin}>
            <div style={{ marginBottom: 18 }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: 6,
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                Admin password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                required
                placeholder="Enter admin password"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  background: 'var(--color-bg)',
                  color: 'var(--color-text)',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'block',
                width: '100%',
                padding: 12,
                background: 'var(--color-brand)',
                color: 'var(--color-brand-text)',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Signing in...' : 'Sign in as admin'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
