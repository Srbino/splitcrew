/** Format money amount with 2 decimal places */
export function formatMoney(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Format date for display */
export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

/** Format datetime for display */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Get initials from a name */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  let initials = (parts[0]?.[0] ?? '').toUpperCase();
  if (parts.length > 1) {
    initials += (parts[parts.length - 1]?.[0] ?? '').toUpperCase();
  }
  return initials;
}

/** Avatar color class based on user ID */
const AVATAR_COLORS = [
  'primary', 'success', 'danger', 'warning',
  'info', 'boat1', 'boat2', 'secondary',
] as const;

export function avatarColorClass(userId: number): string {
  return `avatar-${AVATAR_COLORS[(userId - 1) % AVATAR_COLORS.length]}`;
}

/** JSON API response helper */
export function apiSuccess(data: unknown = null) {
  return Response.json({ success: true, data });
}

export function apiError(error: string, status = 400) {
  return Response.json({ success: false, error }, { status });
}
