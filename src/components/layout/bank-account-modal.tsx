'use client';

import { useEffect, useState } from 'react';
import { Landmark } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { toIban } from '@/lib/czech-payment';

/**
 * Self-service bank account modal (for QR Platba). Shared by the desktop user
 * dropdown and the mobile drawer. Fetches the current account when opened and
 * saves via /api/auth/bank, with a live IBAN preview/validation.
 */
export function BankAccountModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!open) return;
    setMessage('');
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/auth/bank');
      const data = await res.json();
      if (!cancelled && data.success) setValue(data.data?.bank_account || '');
    })();
    return () => { cancelled = true; };
  }, [open]);

  async function handleSave() {
    setSaving(true);
    setMessage('');
    const csrf = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
    const res = await fetch('/api/auth/bank', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ bank_account: value.trim() }),
    });
    const data = await res.json();
    setSaving(false);
    if (data.success) {
      setMessage('✓ ' + (locale === 'cs' ? 'Uloženo' : 'Saved'));
      setTimeout(() => { onClose(); setMessage(''); }, 1200);
    } else {
      setMessage(data.error || 'Error');
    }
  }

  if (!open) return null;
  const previewIban = value.trim() ? toIban(value) : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-xl bg-card border border-border shadow-lg p-5" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Landmark size={16} /> {t('wallet.bankAccount')}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">{t('wallet.bankAccountHint')}</p>
        {message && (
          <div className={`text-sm mb-3 px-3 py-2 rounded-lg ${message.startsWith('✓') ? 'bg-success-subtle text-success' : 'bg-destructive/10 text-destructive'}`}>
            {message}
          </div>
        )}
        <div className="space-y-2">
          <input
            type="text"
            autoComplete="off"
            placeholder="123456789/0800"
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {value.trim() && (
            previewIban ? (
              <p className="text-xs text-success tabular-nums">IBAN: {previewIban}</p>
            ) : (
              <p className="text-xs text-destructive">{t('wallet.bankAccountInvalid')}</p>
            )
          )}
          <div className="flex gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-border bg-transparent cursor-pointer hover:bg-accent transition-colors">
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (value.trim() !== '' && !previewIban)}
              className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground cursor-pointer border-none disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {saving ? t('common.saving') : t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
