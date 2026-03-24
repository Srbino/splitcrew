import { requireAdmin } from '@/lib/auth';

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="page-header">
      <h1 className="page-title">Admin Panel</h1>
      <p style={{ color: 'var(--color-text-secondary)' }}>Coming soon – settings, users, trip configuration</p>
    </div>
  );
}
