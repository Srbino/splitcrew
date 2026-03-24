'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { Separator } from '@/components/ui/separator';
import { NAV_ITEMS, ADMIN_NAV_ITEM } from './nav-items';

interface SidebarProps {
  activePage: string;
  isAdmin?: boolean;
}

export function Sidebar({ activePage, isAdmin }: SidebarProps) {
  const { t } = useI18n();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  return (
    <nav
      className={cn(
        'fixed top-[var(--spacing-topbar)] left-0 bottom-0',
        'w-[var(--spacing-sidebar)] bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]',
        'hidden md:flex flex-col py-3 px-2 overflow-y-auto z-30',
      )}
    >
      <div className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(item => {
          const isActive = activePage === item.page;
          return (
            <Link
              key={item.page}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium',
                'no-underline transition-colors duration-150',
                isActive
                  ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-fg)]'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <item.icon size={17} className="shrink-0" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>

      {isAdmin && (
        <>
          <Separator className="my-3" />
          <Link
            href={ADMIN_NAV_ITEM.href}
            className={cn(
              'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium',
              'no-underline transition-colors duration-150',
              activePage === 'admin'
                ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-fg)]'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <ADMIN_NAV_ITEM.icon size={17} className="shrink-0" />
            {t(ADMIN_NAV_ITEM.labelKey)}
          </Link>
        </>
      )}

      {/* Spacer + Logout at bottom */}
      <div className="flex-1" />
      <Separator className="my-2" />
      <button
        onClick={handleLogout}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium w-full',
          'text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors duration-150',
          'border-none bg-transparent cursor-pointer mb-2',
        )}
      >
        <LogOut size={17} className="shrink-0" />
        {t('auth.logout')}
      </button>
    </nav>
  );
}
