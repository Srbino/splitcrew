'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import { Topbar } from './topbar';
import { Sidebar } from './sidebar';
import { BottomNav } from './bottom-nav';
import { MobileDrawer } from './mobile-drawer';

export interface TripInfo {
  name: string;
  dateFrom: string;
  dateTo: string;
  appIcon: string;
  status: 'before' | 'during' | 'after' | 'none';
  dayLabel: string;
  todayMeal?: string;
}

interface AppShellProps {
  children: React.ReactNode;
  user: {
    id: number;
    name: string;
    avatar?: string | null;
    boatId?: number;
    boatName?: string;
    isAdmin?: boolean;
  };
  trip: TripInfo;
  csrfToken: string;
  baseCurrency?: string;
  allowedCurrencies?: string[];
}

export function AppShell({ children, user, trip, csrfToken, baseCurrency, allowedCurrencies }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { locale } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const activePage = pathname.split('/')[1] || 'dashboard';

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setTheme(isDark ? 'dark' : 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', newTheme);
  }, [theme]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  async function toggleLocale() {
    const newLocale = locale === 'cs' ? 'en' : 'cs';
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ settings: { language: newLocale } }),
    });
    window.location.reload();
  }

  async function uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/avatar', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      window.location.reload();
    }
  }

  return (
    <>
      <meta name="csrf-token" content={csrfToken} />
      <meta name="allowed-currencies" content={JSON.stringify(allowedCurrencies || [])} />
      <meta name="base-currency" content={baseCurrency || 'EUR'} />

      <Topbar
        user={user}
        trip={trip}
        theme={theme}
        locale={locale}
        onToggleTheme={toggleTheme}
        onToggleLocale={toggleLocale}
        onToggleMobileMenu={toggleMobileMenu}
        onLogout={handleLogout}
        onUploadAvatar={uploadAvatar}
      />

      <Sidebar activePage={activePage} isAdmin={user.isAdmin} />

      <BottomNav activePage={activePage} onToggleMobileMenu={toggleMobileMenu} />

      <MobileDrawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        activePage={activePage}
        theme={theme}
        locale={locale}
        onToggleTheme={toggleTheme}
        onToggleLocale={toggleLocale}
        onLogout={handleLogout}
        onUploadAvatar={uploadAvatar}
      />

      <main className="pt-[var(--spacing-topbar)] md:pl-[var(--spacing-sidebar)] pb-[calc(var(--spacing-bottomnav)+env(safe-area-inset-bottom,0px))] md:pb-0 min-h-screen">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6">
          {children}
        </div>
      </main>
    </>
  );
}
