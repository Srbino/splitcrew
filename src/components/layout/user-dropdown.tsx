'use client';

import { useRef } from 'react';
import { useState } from 'react';
import { ChevronDown, Moon, Sun, LogOut, Camera, Sailboat, Languages, KeyRound } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, avatarColorClass } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

interface UserDropdownProps {
  user: {
    id: number;
    name: string;
    avatar?: string | null;
    boatName?: string;
  };
  theme: 'light' | 'dark';
  locale: string;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onLogout: () => void;
  onUploadAvatar: (file: File) => void;
}

export function UserDropdown({ user, theme, locale, onToggleTheme, onToggleLocale, onLogout, onUploadAvatar }: UserDropdownProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showPwModal, setShowPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState('');

  async function handleChangePassword() {
    if (!currentPw || !newPw || newPw.length < 4) return;
    setPwSaving(true);
    setPwMessage('');
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
    });
    const data = await res.json();
    setPwSaving(false);
    if (data.success) {
      setPwMessage('✓ ' + (data.data?.message || 'Password updated'));
      setCurrentPw('');
      setNewPw('');
      setTimeout(() => { setShowPwModal(false); setPwMessage(''); }, 1500);
    } else {
      setPwMessage(data.error || 'Error');
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onUploadAvatar(file);
    e.target.value = '';
  }

  const avatarSrc = user.avatar ? (user.avatar.startsWith('/') ? user.avatar : `/${user.avatar}`) : null;

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors cursor-pointer border-none bg-transparent">
            <Avatar className="h-7 w-7">
              {avatarSrc && <AvatarImage src={avatarSrc} alt={user.name} />}
              <AvatarFallback className={`text-xs font-semibold ${avatarColorClass(user.id)}`}>
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">{user.name}</span>
            <ChevronDown size={14} className="text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          {/* User header */}
          <div className="flex items-center gap-3 px-3 py-3">
            <div
              className="relative cursor-pointer"
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
              <Avatar className="h-10 w-10">
                {avatarSrc && <AvatarImage src={avatarSrc} alt={user.name} />}
                <AvatarFallback className={`text-sm font-semibold ${avatarColorClass(user.id)}`}>
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center border-2 border-card shadow-sm">
                <Camera size={10} className="text-primary-foreground" />
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{user.name}</span>
              {user.boatName && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sailboat size={11} /> {user.boatName}
                </span>
              )}
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={onToggleTheme} className="cursor-pointer">
            {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'light' ? t('nav.darkMode') : t('nav.lightMode')}</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onToggleLocale} className="cursor-pointer">
            <Languages size={16} />
            <span>{locale === 'cs' ? 'English' : 'Čeština'}</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setShowPwModal(true)} className="cursor-pointer">
            <KeyRound size={16} />
            <span>{t('auth.password')}</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={onLogout} className="cursor-pointer text-destructive focus:text-destructive">
            <LogOut size={16} />
            <span>{t('auth.logout')}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Password change modal */}
      {showPwModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowPwModal(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-sm rounded-xl bg-card border border-border shadow-lg p-5" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold mb-4">{t('auth.password')}</h3>
            {pwMessage && (
              <div className={`text-sm mb-3 px-3 py-2 rounded-lg ${pwMessage.startsWith('✓') ? 'bg-success-subtle text-success' : 'bg-destructive/10 text-destructive'}`}>
                {pwMessage}
              </div>
            )}
            <div className="space-y-3">
              <input
                type="password"
                placeholder={locale === 'cs' ? 'Aktuální heslo' : 'Current password'}
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <input
                type="password"
                placeholder={locale === 'cs' ? 'Nové heslo (min 4 znaky)' : 'New password (min 4 chars)'}
                value={newPw}
                onChange={e => setNewPw(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <div className="flex gap-2 justify-end pt-1">
                <button onClick={() => setShowPwModal(false)} className="px-3 py-1.5 text-sm rounded-md border border-border bg-transparent cursor-pointer hover:bg-accent transition-colors">
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={pwSaving || !currentPw || newPw.length < 4}
                  className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground cursor-pointer border-none disabled:opacity-50 hover:opacity-90 transition-opacity"
                >
                  {pwSaving ? t('common.saving') : t('common.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
