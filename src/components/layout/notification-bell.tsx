'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Lock, Unlock, Clock, Check, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

interface NotificationItem {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  read: boolean;
}

function csrf(): string {
  if (typeof document === 'undefined') return '';
  return document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
}

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  wallet_closed: Lock,
  wallet_reopened: Unlock,
  expense_pending: Clock,
  expense_approved: Check,
  expense_rejected: X,
};

export function NotificationBell() {
  const router = useRouter();
  const { t } = useI18n();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      const json = await res.json();
      if (json.success && json.data) {
        setItems(json.data.items);
        setUnread(json.data.unread_count);
      }
    } catch { /* offline — ignore */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const markAllRead = async () => {
    setUnread(0);
    setItems(prev => prev.map(i => ({ ...i, read: true })));
    await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
      body: JSON.stringify({ action: 'mark_all_read' }),
    });
  };

  const openItem = async (item: NotificationItem) => {
    setOpen(false);
    if (!item.read) {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf() },
        body: JSON.stringify({ action: 'mark_read', id: item.id }),
      });
      load();
    }
    if (item.link) router.push(item.link);
  };

  function timeAgo(dateStr: string): string {
    const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  return (
    <DropdownMenu open={open} onOpenChange={(o) => { setOpen(o); if (o) load(); }}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex items-center justify-center w-9 h-9 rounded-full hover:bg-accent transition-colors shrink-0 border-none bg-transparent cursor-pointer text-foreground"
          aria-label={t('notifications.title')}
        >
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-semibold">{t('notifications.title')}</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline bg-transparent border-none cursor-pointer">
              {t('notifications.markAllRead')}
            </button>
          )}
        </div>
        <div className="max-h-[360px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              {t('notifications.empty')}
            </div>
          ) : (
            items.map(item => {
              const Icon = ICONS[item.type] ?? Bell;
              return (
                <button
                  key={item.id}
                  onClick={() => openItem(item)}
                  className={cn(
                    'w-full text-left flex gap-2.5 px-3 py-2.5 border-b border-border last:border-0 hover:bg-accent transition-colors bg-transparent border-x-0 border-t-0 cursor-pointer',
                    !item.read && 'bg-primary/5',
                  )}
                >
                  <Icon size={15} className="mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('text-sm truncate', !item.read && 'font-semibold')}>{item.title}</span>
                      {!item.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                    </div>
                    {item.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.body}</p>}
                    <span className="text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
