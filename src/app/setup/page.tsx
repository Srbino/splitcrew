'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Sailboat, ArrowRight, ArrowLeft, Plus, Trash2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

const BOAT_EMOJIS = ['⛵', '🚢', '🛥️', '⚓', '🌊', '🏴‍☠️', '🐬', '🦈', '🌴', '🗺️'];
const BOAT_COLORS = [
  { value: 'blue', tw: 'bg-blue-500' },
  { value: 'teal', tw: 'bg-teal-500' },
  { value: 'purple', tw: 'bg-purple-500' },
  { value: 'orange', tw: 'bg-orange-500' },
  { value: 'rose', tw: 'bg-rose-500' },
  { value: 'emerald', tw: 'bg-emerald-500' },
];

interface BoatDraft { name: string; emoji: string; color: string }
interface UserDraft { name: string; email: string; phone: string; password: string; boat_index: number; role: string }

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Admin
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [language, setLanguage] = useState('en');

  // Step 2: Trip
  const [tripName, setTripName] = useState('');
  const [tripFrom, setTripFrom] = useState('');
  const [tripTo, setTripTo] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [appIcon, setAppIcon] = useState('⛵');

  // Step 3: Boats
  const [boats, setBoats] = useState<BoatDraft[]>([
    { name: '', emoji: '⛵', color: 'blue' },
  ]);

  // Step 4: Users
  const [users, setUsers] = useState<UserDraft[]>([
    { name: '', email: '', phone: '', password: '', boat_index: 0, role: 'captain' },
  ]);

  // Check if already installed
  useEffect(() => {
    fetch('/api/setup')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.installed) {
          router.replace('/');
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  const steps = [
    { title: language === 'cs' ? 'Admin heslo' : 'Admin Password', icon: '🔐' },
    { title: language === 'cs' ? 'Nastavení výletu' : 'Trip Setup', icon: '🗺️' },
    { title: language === 'cs' ? 'Lodě' : 'Boats', icon: '⛵' },
    { title: language === 'cs' ? 'Posádka' : 'Crew', icon: '👥' },
  ];

  function canProceed(): boolean {
    if (step === 0) return adminPassword.length >= 4 && adminPassword === adminPasswordConfirm;
    if (step === 1) return tripName.trim().length > 0;
    if (step === 2) return boats.some(b => b.name.trim().length > 0);
    if (step === 3) return users.some(u => u.name.trim().length > 0 && u.password.length >= 4);
    return false;
  }

  async function handleFinish() {
    setSaving(true);
    setError('');

    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        admin_password: adminPassword,
        language,
        trip_name: tripName,
        trip_date_from: tripFrom,
        trip_date_to: tripTo,
        base_currency: baseCurrency,
        app_icon: appIcon,
        boats: boats.filter(b => b.name.trim()),
        users: users.filter(u => u.name.trim() && u.password),
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (data.success) {
      router.push('/');
    } else {
      setError(data.error || 'Setup failed');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/50">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const isLast = step === 3;
  const L = language === 'cs';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/50">
      <div className="fixed inset-0 bg-gradient-to-br from-primary/5 via-transparent to-info/5 pointer-events-none" />

      <motion.div
        className="relative w-full max-w-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 20 }}
      >
        <Card className="border shadow-lg overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
                <Sailboat className="text-primary" size={28} />
              </div>
              <div>
                <h1 className="text-xl font-bold">SplitCrew</h1>
                <p className="text-xs text-muted-foreground">
                  {L ? 'Nastavení nové výpravy' : 'New trip setup'}
                </p>
              </div>
            </div>

            {/* Step indicators */}
            <div className="flex gap-1.5">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-1 h-1.5 rounded-full transition-all duration-300',
                    i <= step ? 'bg-primary' : 'bg-muted',
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-lg">{steps[step].icon}</span>
              <span className="text-sm font-semibold">{steps[step].title}</span>
              <span className="text-xs text-muted-foreground ml-auto">{step + 1}/{steps.length}</span>
            </div>
          </div>

          <CardContent className="px-6 pb-6">
            {error && (
              <div className="bg-destructive/10 text-destructive text-sm px-4 py-2 rounded-lg mb-4">{error}</div>
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {/* Step 0: Admin password + language */}
                {step === 0 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{L ? 'Jazyk' : 'Language'}</Label>
                      <div className="flex gap-2">
                        {[{ code: 'en', flag: '🇬🇧', name: 'English' }, { code: 'cs', flag: '🇨🇿', name: 'Čeština' }].map(l => (
                          <button
                            key={l.code}
                            onClick={() => setLanguage(l.code)}
                            className={cn(
                              'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border-2 cursor-pointer text-sm font-medium transition-all border-none',
                              language === l.code ? 'bg-primary/10 ring-2 ring-primary' : 'bg-muted/50 hover:bg-muted',
                            )}
                          >
                            <span className="text-lg">{l.flag}</span>
                            {l.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{L ? 'Admin heslo' : 'Admin Password'}</Label>
                      <Input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                        placeholder={L ? 'Min 4 znaky' : 'Min 4 characters'} />
                    </div>
                    <div className="space-y-2">
                      <Label>{L ? 'Potvrdit heslo' : 'Confirm Password'}</Label>
                      <Input type="password" value={adminPasswordConfirm} onChange={e => setAdminPasswordConfirm(e.target.value)}
                        placeholder={L ? 'Znovu zadej heslo' : 'Re-enter password'} />
                      {adminPasswordConfirm && adminPassword !== adminPasswordConfirm && (
                        <p className="text-xs text-destructive">{L ? 'Hesla se neshodují' : 'Passwords do not match'}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 1: Trip info */}
                {step === 1 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{L ? 'Název výletu' : 'Trip Name'} *</Label>
                      <Input value={tripName} onChange={e => setTripName(e.target.value)}
                        placeholder={L ? 'např. Jadranská plavba 2026' : 'e.g. Adriatic Sailing 2026'} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{L ? 'Datum od' : 'Start Date'}</Label>
                        <Input type="date" value={tripFrom} onChange={e => setTripFrom(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>{L ? 'Datum do' : 'End Date'}</Label>
                        <Input type="date" value={tripTo} onChange={e => setTripTo(e.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>{L ? 'Měna' : 'Currency'}</Label>
                        <select value={baseCurrency} onChange={e => setBaseCurrency(e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm">
                          {['EUR', 'CZK', 'USD', 'GBP', 'CHF', 'PLN', 'HRK', 'HUF'].map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>{L ? 'Ikona' : 'App Icon'}</Label>
                        <div className="flex flex-wrap gap-1">
                          {['⛵', '🚢', '🌊', '⚓', '🏴‍☠️', '🗺️'].map(e => (
                            <button key={e} onClick={() => setAppIcon(e)}
                              className={cn('w-8 h-8 rounded text-base flex items-center justify-center border-none cursor-pointer',
                                appIcon === e ? 'bg-primary/15 ring-2 ring-primary' : 'bg-muted/50 hover:bg-muted')}>
                              {e}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Boats */}
                {step === 2 && (
                  <div className="space-y-3">
                    {boats.map((boat, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 rounded-lg border border-border">
                        <div className="flex-1 space-y-2">
                          <Input value={boat.name} onChange={e => {
                            const b = [...boats]; b[i].name = e.target.value; setBoats(b);
                          }} placeholder={L ? `Loď ${i + 1}` : `Boat ${i + 1}`} />
                          <div className="flex gap-1">
                            {BOAT_EMOJIS.slice(0, 6).map(e => (
                              <button key={e} onClick={() => { const b = [...boats]; b[i].emoji = e; setBoats(b); }}
                                className={cn('w-7 h-7 rounded text-sm flex items-center justify-center border-none cursor-pointer',
                                  boat.emoji === e ? 'bg-primary/15 ring-1 ring-primary' : 'bg-muted/50')}>
                                {e}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            {BOAT_COLORS.map(c => (
                              <button key={c.value} onClick={() => { const b = [...boats]; b[i].color = c.value; setBoats(b); }}
                                className={cn('w-5 h-5 rounded-full border-none cursor-pointer', c.tw,
                                  boat.color === c.value ? 'ring-2 ring-offset-1 ring-primary' : 'opacity-50')}>
                              </button>
                            ))}
                          </div>
                        </div>
                        {boats.length > 1 && (
                          <Button variant="ghost" size="sm" className="text-destructive shrink-0"
                            onClick={() => setBoats(boats.filter((_, j) => j !== i))}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full"
                      onClick={() => setBoats([...boats, { name: '', emoji: '🚢', color: 'teal' }])}>
                      <Plus size={14} className="mr-1" /> {L ? 'Přidat loď' : 'Add Boat'}
                    </Button>
                  </div>
                )}

                {/* Step 3: Crew */}
                {step === 3 && (
                  <div className="space-y-3">
                    {users.map((user, i) => (
                      <div key={i} className="p-3 rounded-lg border border-border space-y-2">
                        <div className="flex gap-2">
                          <Input value={user.name} onChange={e => { const u = [...users]; u[i].name = e.target.value; setUsers(u); }}
                            placeholder={L ? 'Jméno' : 'Name'} className="flex-1" />
                          <select value={user.boat_index} onChange={e => { const u = [...users]; u[i].boat_index = parseInt(e.target.value); setUsers(u); }}
                            className="flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm w-28">
                            {boats.filter(b => b.name.trim()).map((b, j) => (
                              <option key={j} value={j}>{b.emoji} {b.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <Input type="password" value={user.password}
                            onChange={e => { const u = [...users]; u[i].password = e.target.value; setUsers(u); }}
                            placeholder={L ? 'Heslo (min 4)' : 'Password (min 4)'} className="flex-1" />
                          <select value={user.role} onChange={e => { const u = [...users]; u[i].role = e.target.value; setUsers(u); }}
                            className="flex h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm w-28">
                            <option value="crew">{L ? 'Člen' : 'Crew'}</option>
                            <option value="captain">{L ? 'Kapitán' : 'Captain'}</option>
                          </select>
                        </div>
                        {users.length > 1 && (
                          <Button variant="ghost" size="sm" className="text-destructive"
                            onClick={() => setUsers(users.filter((_, j) => j !== i))}>
                            <Trash2 size={14} className="mr-1" /> {L ? 'Odebrat' : 'Remove'}
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full"
                      onClick={() => setUsers([...users, { name: '', email: '', phone: '', password: '', boat_index: 0, role: 'crew' }])}>
                      <Plus size={14} className="mr-1" /> {L ? 'Přidat člena' : 'Add Crew Member'}
                    </Button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex justify-between mt-6 pt-4 border-t border-border">
              {step > 0 ? (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  <ArrowLeft size={14} className="mr-1" /> {L ? 'Zpět' : 'Back'}
                </Button>
              ) : <div />}

              {isLast ? (
                <Button onClick={handleFinish} disabled={!canProceed() || saving}>
                  {saving ? (L ? 'Ukládání...' : 'Saving...') : (
                    <><Check size={14} className="mr-1" /> {L ? 'Dokončit' : 'Finish'}</>
                  )}
                </Button>
              ) : (
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                  {L ? 'Další' : 'Next'} <ArrowRight size={14} className="ml-1" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
