'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { Moon, Sun, LogOut, Camera, Sailboat, ChevronRight, X, Languages } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { cn, getInitials, avatarColorClass } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { NAV_ITEMS, ADMIN_NAV_ITEM, type NavItem } from './nav-items';

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  user: {
    id: number;
    name: string;
    avatar?: string | null;
    boatName?: string;
    isAdmin?: boolean;
  };
  activePage: string;
  theme: 'light' | 'dark';
  locale: string;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onLogout: () => void;
  onUploadAvatar: (file: File) => void;
}

export function MobileDrawer({
  open, onClose, user, activePage, theme, locale, onToggleTheme, onToggleLocale, onLogout, onUploadAvatar,
}: MobileDrawerProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarSrc = user.avatar ? (user.avatar.startsWith('data:') || user.avatar.startsWith('http') ? user.avatar : `/${user.avatar}`) : null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUploadAvatar(file);
    e.target.value = '';
  }

  const allNavItems: NavItem[] = user.isAdmin
    ? [...NAV_ITEMS, ADMIN_NAV_ITEM]
    : NAV_ITEMS;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent side="right" className="w-72 p-0 flex flex-col [&>button]:hidden">
          <SheetHeader className="p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
          </SheetHeader>

          {/* User header */}
          <div className="flex items-center gap-3 p-4 border-b border-border">
            <div
              className="relative cursor-pointer shrink-0"
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Change avatar"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <Avatar className="h-11 w-11">
                {avatarSrc && <AvatarImage src={avatarSrc} alt={user.name} />}
                <AvatarFallback className={`text-sm font-semibold ${avatarColorClass(user.id)}`}>
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-card shadow-sm">
                <Camera size={10} className="text-primary-foreground" />
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate">{user.name}</span>
              {user.boatName && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Sailboat size={11} /> {user.boatName}
                </span>
              )}
            </div>
            <button
              className="ml-auto flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent transition-colors border-none bg-transparent cursor-pointer"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={20} className="text-muted-foreground" />
            </button>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 overflow-y-auto py-2 px-2">
            <div className="flex flex-col gap-0.5">
              {allNavItems.map(item => {
                const isActive = activePage === item.page;
                return (
                  <Link
                    key={item.page}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium',
                      'no-underline transition-colors duration-150',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-accent',
                    )}
                    onClick={onClose}
                  >
                    <item.icon size={18} className="shrink-0" />
                    <span>{t(item.labelKey)}</span>
                    {isActive && (
                      <ChevronRight size={15} className="ml-auto text-muted-foreground" />
                    )}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Footer actions */}
          <div className="p-3 border-t border-border space-y-1">
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium text-foreground hover:bg-accent transition-colors border-none bg-transparent cursor-pointer"
              onClick={onToggleTheme}
            >
              {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
              <span>{theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}</span>
            </button>
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium text-foreground hover:bg-accent transition-colors border-none bg-transparent cursor-pointer"
              onClick={onToggleLocale}
            >
              <Languages size={17} />
              <span>{locale === 'cs' ? 'English' : 'Čeština'}</span>
            </button>
            <button
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors border-none bg-transparent cursor-pointer"
              onClick={onLogout}
            >
              <LogOut size={17} />
              <span>{t('auth.logout')}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
