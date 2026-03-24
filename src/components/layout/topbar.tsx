'use client';

import Link from 'next/link';
import { cn, getInitials, avatarColorClass } from '@/lib/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserDropdown } from './user-dropdown';
import type { TripInfo } from './app-shell';

interface TopbarProps {
  user: {
    id: number;
    name: string;
    avatar?: string | null;
    boatName?: string;
    isAdmin?: boolean;
  };
  trip: TripInfo;
  theme: 'light' | 'dark';
  locale: string;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onToggleMobileMenu: () => void;
  onLogout: () => void;
  onUploadAvatar: (file: File) => void;
}

export function Topbar({
  user, trip, theme, locale, onToggleTheme, onToggleLocale, onToggleMobileMenu, onLogout, onUploadAvatar,
}: TopbarProps) {
  const avatarSrc = user.avatar ? (user.avatar.startsWith('/') ? user.avatar : `/${user.avatar}`) : null;

  const statusColors = {
    before: 'bg-primary/10 text-primary border-0',
    during: 'bg-success-subtle text-success border-0',
    after: 'bg-muted text-muted-foreground border-0',
    none: '',
  };

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'h-[var(--spacing-topbar)] bg-card border-b border-border',
        'flex items-center px-4 gap-2',
      )}
    >
      {/* App icon + Trip name */}
      <Link
        href="/dashboard"
        className="flex items-center gap-2 font-semibold text-sm text-foreground no-underline hover:no-underline shrink-0 min-w-0"
      >
        <span className="text-lg leading-none shrink-0">{trip.appIcon || '⛵'}</span>
        <span className="hidden sm:inline truncate max-w-[160px]">{trip.name}</span>
      </Link>

      {/* Trip countdown badge */}
      {trip.status !== 'none' && trip.dayLabel && (
        <Badge
          variant="secondary"
          className={cn('text-[10px] font-semibold shrink-0 hidden xs:inline-flex sm:inline-flex', statusColors[trip.status])}
        >
          {trip.dayLabel}
        </Badge>
      )}

      {/* Today's meal (desktop only, compact) */}
      {trip.todayMeal && (
        <Link
          href="/menu"
          className="hidden lg:flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground no-underline transition-colors shrink-0 max-w-[180px]"
          title={`Today's lunch: ${trip.todayMeal}`}
        >
          <span>🍽</span>
          <span className="truncate">{trip.todayMeal}</span>
        </Link>
      )}

      {/* Spacer */}
      <div className="flex-1 min-w-0" />

      {/* Mobile: show countdown if hidden above */}
      {trip.status !== 'none' && trip.dayLabel && (
        <Badge
          variant="secondary"
          className={cn('text-[10px] font-semibold sm:hidden', statusColors[trip.status])}
        >
          {trip.dayLabel}
        </Badge>
      )}

      {/* Desktop user dropdown */}
      <div className="hidden md:block shrink-0">
        <UserDropdown
          user={user}
          theme={theme}
          locale={locale}
          onToggleTheme={onToggleTheme}
          onToggleLocale={onToggleLocale}
          onLogout={onLogout}
          onUploadAvatar={onUploadAvatar}
        />
      </div>

      {/* Mobile: avatar → opens drawer */}
      <button
        className="md:hidden flex items-center justify-center rounded-full hover:ring-2 hover:ring-ring/30 transition-all shrink-0"
        onClick={onToggleMobileMenu}
        aria-label="Open menu"
      >
        <Avatar className="h-8 w-8">
          {avatarSrc && <AvatarImage src={avatarSrc} alt={user.name} />}
          <AvatarFallback className={cn('text-[11px] font-semibold', avatarColorClass(user.id))}>
            {getInitials(user.name)}
          </AvatarFallback>
        </Avatar>
      </button>
    </header>
  );
}
