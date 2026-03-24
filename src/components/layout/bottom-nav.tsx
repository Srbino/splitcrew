'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { BOTTOM_NAV_ITEMS, MORE_NAV_ITEM } from './nav-items';

interface BottomNavProps {
  activePage: string;
  onToggleMobileMenu: () => void;
}

export function BottomNav({ activePage, onToggleMobileMenu }: BottomNavProps) {
  const { t } = useI18n();

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'md:hidden flex items-end justify-around',
        'bg-card/95 backdrop-blur-lg border-t border-border',
        'h-[var(--spacing-bottomnav)] pb-safe',
      )}
    >
      {BOTTOM_NAV_ITEMS.map(item => {
        const isActive = activePage === item.page;
        return (
          <Link
            key={item.page}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5',
              'no-underline text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <item.icon size={22} className={cn(isActive && 'scale-110')} />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
      <button
        className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 text-[10px] font-medium text-muted-foreground bg-transparent border-none cursor-pointer"
        onClick={onToggleMobileMenu}
      >
        <MORE_NAV_ITEM.icon size={22} />
        <span>{t(MORE_NAV_ITEM.labelKey)}</span>
      </button>
    </nav>
  );
}
