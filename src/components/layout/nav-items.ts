import {
  Home, Wallet, ShoppingCart, BookOpen, Map, Users,
  Utensils, CheckSquare, Car, Settings, Menu,
} from 'lucide-react';

export type NavItem = {
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  labelKey: string;
  page: string;
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  icon: Home,         labelKey: 'nav.home',      page: 'dashboard' },
  { href: '/itinerary',  icon: Map,          labelKey: 'nav.itinerary', page: 'itinerary' },
  { href: '/crews',      icon: Users,        labelKey: 'nav.crews',     page: 'crews' },
  { href: '/shopping',   icon: ShoppingCart,  labelKey: 'nav.shopping', page: 'shopping' },
  { href: '/menu',       icon: Utensils,     labelKey: 'nav.menuPlan',  page: 'menu' },
  { href: '/wallet',     icon: Wallet,       labelKey: 'nav.wallet',    page: 'wallet' },
  { href: '/checklist',  icon: CheckSquare,  labelKey: 'nav.checklist', page: 'checklist' },
  { href: '/logbook',    icon: BookOpen,     labelKey: 'nav.logbook',   page: 'logbook' },
  { href: '/cars',       icon: Car,          labelKey: 'nav.cars',      page: 'cars' },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  icon: Home,         labelKey: 'nav.home',     page: 'dashboard' },
  { href: '/wallet',     icon: Wallet,       labelKey: 'nav.wallet',   page: 'wallet' },
  { href: '/shopping',   icon: ShoppingCart,  labelKey: 'nav.shopping', page: 'shopping' },
  { href: '/logbook',    icon: BookOpen,     labelKey: 'nav.logbook',  page: 'logbook' },
];

export const ADMIN_NAV_ITEM: NavItem = {
  href: '/admin',
  icon: Settings,
  labelKey: 'nav.admin',
  page: 'admin',
};

export const MORE_NAV_ITEM = {
  icon: Menu,
  labelKey: 'nav.more',
};
