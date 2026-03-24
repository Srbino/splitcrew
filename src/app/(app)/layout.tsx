import { requireAuth, readCsrfToken } from '@/lib/auth';
import { getUserById, getSetting } from '@/lib/db';
import { query } from '@/lib/db';
import Layout from '@/components/Layout';
import { ToastProvider } from '@/components/Toast';
import { I18nProvider } from '@/lib/i18n/context';
import type { LocaleCode } from '@/lib/i18n';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuth();
  const csrfToken = await readCsrfToken();

  // Get app settings
  const locale = (await getSetting('language', 'en')) as LocaleCode;
  const baseCurrency = await getSetting('base_currency', 'EUR');

  // Get user info
  let userName = session.userName || 'Guest';
  let userAvatar: string | null = null;
  let boatId = session.boatId || 0;
  let boatName = '';

  if (session.userId) {
    const user = await getUserById(session.userId);
    if (user) {
      userName = user.name;
      userAvatar = user.avatar;
      boatId = user.boat_id;
    }
  }

  // Get boat name
  if (boatId) {
    const boat = await query<{ name: string }>(
      'SELECT name FROM boats WHERE id = $1',
      [boatId]
    );
    boatName = boat[0]?.name || '';
  }

  return (
    <I18nProvider locale={locale}>
      <ToastProvider>
        <Layout
          user={{
            id: session.userId || 0,
            name: userName,
            avatar: userAvatar,
            boatId,
            boatName,
            isAdmin: session.isAdmin,
          }}
          csrfToken={csrfToken}
          baseCurrency={baseCurrency}
        >
          {children}
        </Layout>
      </ToastProvider>
    </I18nProvider>
  );
}
