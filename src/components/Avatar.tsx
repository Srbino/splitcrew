import { getInitials, avatarColorClass } from '@/lib/utils';

interface AvatarProps {
  name: string;
  avatar?: string | null;
  size?: 'sm' | 'md' | 'lg';
  userId?: number;
}

export function Avatar({ name, avatar, size = 'md', userId = 1 }: AvatarProps) {
  if (avatar) {
    const src = avatar.startsWith('/') ? avatar : `/${avatar}`;
    return (
      <img
        src={src}
        alt={name}
        className={`avatar avatar-${size}`}
        style={{ objectFit: 'cover', border: '2px solid var(--color-border)' }}
      />
    );
  }

  return (
    <span className={`avatar avatar-${size} ${avatarColorClass(userId)}`}>
      {getInitials(name)}
    </span>
  );
}
