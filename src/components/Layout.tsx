'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Home, Wallet, ShoppingCart, BookOpen, Map, Users,
  Utensils, CheckSquare, Car, Settings, Menu, X,
  ChevronDown, ChevronRight, Moon, Sun, LogOut,
  Sailboat, Camera, Grid2x2,
} from 'lucide-react';
import { Avatar } from './Avatar';
import { useI18n } from '@/lib/i18n/context';

interface LayoutProps {
  children: React.ReactNode;
  user: {
    id: number;
    name: string;
    avatar?: string | null;
    boatId?: number;
    boatName?: string;
    isAdmin?: boolean;
  };
  csrfToken: string;
  baseCurrency?: string;
}

type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  labelKey: string;
  page: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  icon: Home,         labelKey: 'nav.home',      page: 'dashboard' },
  { href: '/itinerary',  icon: Map,          labelKey: 'nav.itinerary', page: 'itinerary' },
  { href: '/crews',      icon: Users,        labelKey: 'nav.crews',     page: 'crews' },
  { href: '/shopping',   icon: ShoppingCart,  labelKey: 'nav.shopping', page: 'shopping' },
  { href: '/menu',       icon: Utensils,     labelKey: 'nav.menuPlan',  page: 'menu' },
  { href: '/wallet',     icon: Wallet,       labelKey: 'nav.wallet',    page: 'wallet' },
  { href: '/checklist',  icon: CheckSquare,  labelKey: 'nav.checklist', page: 'checklist' },
  { href: '/logbook',    icon: BookOpen,     labelKey: 'nav.logbook',   page: 'logbook' },
  { href: '/cars',       icon: Car,          labelKey: 'nav.cars',      page: 'cars' },
];

const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  icon: Home,         labelKey: 'nav.home',     page: 'dashboard' },
  { href: '/wallet',     icon: Wallet,       labelKey: 'nav.wallet',   page: 'wallet' },
  { href: '/shopping',   icon: ShoppingCart,  labelKey: 'nav.shopping', page: 'shopping' },
  { href: '/logbook',    icon: BookOpen,     labelKey: 'nav.logbook',  page: 'logbook' },
];

export default function Layout({ children, user, csrfToken, baseCurrency }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const activePage = pathname.split('/')[1] || 'dashboard';

  useEffect(() => {
    const t = document.documentElement.getAttribute('data-theme') as 'light' | 'dark';
    setTheme(t || 'light');
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  }, [theme]);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev);
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!userDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-dropdown-wrap')) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [userDropdownOpen]);

  // Close mobile menu on escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileMenuOpen]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const allNavItems: NavItem[] = user.isAdmin
    ? [...NAV_ITEMS, { href: '/admin', icon: Settings, labelKey: 'nav.admin', page: 'admin' }]
    : NAV_ITEMS;

  return (
    <>
      <meta name="csrf-token" content={csrfToken} />

      {/* Top bar */}
      <header className="top-bar">
        <Link href="/dashboard" className="top-bar-logo">
          <img src="/img/logo.png" alt="Logo" width={20} height={20} />
          <span>CrewSplit</span>
        </Link>
        <div className="top-bar-actions">
          {/* Desktop user dropdown */}
          <div className="user-dropdown-wrap">
            <button
              className="top-bar-avatar-btn"
              onClick={() => setUserDropdownOpen(prev => !prev)}
            >
              <Avatar name={user.name} avatar={user.avatar} size="sm" />
              <span className="top-bar-user-name">{user.name}</span>
              <ChevronDown size={14} style={{ opacity: 0.6 }} />
            </button>
            {userDropdownOpen && (
              <div className="user-dropdown" style={{ display: 'block' }}>
                <div className="user-dropdown-header">
                  <div className="user-dropdown-avatar">
                    <Avatar name={user.name} avatar={user.avatar} size="lg" />
                  </div>
                  <div className="user-dropdown-name">{user.name}</div>
                  {user.boatName && (
                    <div className="user-dropdown-boat">
                      <Sailboat size={12} /> {user.boatName}
                    </div>
                  )}
                </div>
                <div className="user-dropdown-links">
                  <button className="user-dropdown-link" onClick={toggleTheme}>
                    {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
                    <span>{theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}</span>
                  </button>
                  <button className="user-dropdown-link" onClick={handleLogout}>
                    <LogOut size={16} /> {t('auth.logout')}
                  </button>
                </div>
              </div>
            )}
          </div>
          {/* Hamburger – mobile only */}
          <button
            className="top-bar-btn top-bar-hamburger"
            onClick={toggleMobileMenu}
            aria-label="Menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </header>

      {/* Sidebar (desktop) */}
      <nav className="sidebar">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.page}
            href={item.href}
            className={`sidebar-link ${activePage === item.page ? 'active' : ''}`}
          >
            <item.icon className="sidebar-icon" />
            {t(item.labelKey)}
          </Link>
        ))}
        {user.isAdmin && (
          <>
            <hr className="sidebar-divider" />
            <Link
              href="/admin"
              className={`sidebar-link ${activePage === 'admin' ? 'active' : ''}`}
            >
              <Settings className="sidebar-icon" /> {t('nav.admin')}
            </Link>
          </>
        )}
      </nav>

      {/* Bottom navigation (mobile) */}
      <nav className="bottom-nav">
        {BOTTOM_NAV_ITEMS.map(item => (
          <Link
            key={item.page}
            href={item.href}
            className={`bottom-nav-item ${activePage === item.page ? 'active' : ''}`}
          >
            <item.icon className="bottom-nav-icon" />
            <span className="bottom-nav-label">{t(item.labelKey)}</span>
          </Link>
        ))}
        <button
          className="bottom-nav-item"
          onClick={toggleMobileMenu}
          style={{ background: 'none', border: 'none', cursor: 'pointer' }}
        >
          <Grid2x2 className="bottom-nav-icon" />
          <span className="bottom-nav-label">{t('nav.more')}</span>
        </button>
      </nav>

      {/* Mobile drawer menu */}
      <div
        className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
      >
        <div className="mobile-menu-overlay" onClick={toggleMobileMenu} />
        <div className="mobile-menu-content">
          <div className="drawer-header">
            <div className="drawer-header-user">
              <div className="drawer-avatar-wrap">
                <Avatar name={user.name} avatar={user.avatar} size="lg" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                  {user.name}
                </div>
                {user.boatName && (
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--color-text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      marginTop: 2,
                    }}
                  >
                    <Sailboat size={11} /> {user.boatName}
                  </div>
                )}
              </div>
            </div>
            <button className="drawer-close" onClick={toggleMobileMenu} aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <nav className="drawer-nav">
            {allNavItems.map(item => {
              const isActive = activePage === item.page;
              return (
                <Link
                  key={item.page}
                  href={item.href}
                  className={`drawer-link ${isActive ? 'active' : ''}`}
                  onClick={toggleMobileMenu}
                >
                  <span className="drawer-link-icon">
                    <item.icon size={18} />
                  </span>
                  <span className="drawer-link-label">{t(item.labelKey)}</span>
                  {isActive && (
                    <ChevronRight
                      size={15}
                      style={{ color: 'var(--color-text-tertiary)', marginLeft: 'auto' }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="drawer-footer">
            <button
              className="drawer-logout"
              onClick={toggleTheme}
              style={{ marginBottom: 12, border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
              <span>{theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}</span>
            </button>
            <br />
            <button
              className="drawer-logout"
              onClick={handleLogout}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              <LogOut size={17} /> {t('auth.logout')}
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="main-content">{children}</main>
    </>
  );
}
