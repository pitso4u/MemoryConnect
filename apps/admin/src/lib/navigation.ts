import type { ComponentType } from 'react';
import { Activity, BarChart3, Building2, ClipboardList, CreditCard, FileClock, FileText, Flag, LayoutDashboard, LifeBuoy, Megaphone, MessageSquare, Package, Phone, Plus, Tags, Truck, Users, WalletCards } from 'lucide-react';

export interface NavLinkItem {
  type: 'link';
  to: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  end?: boolean;
  featureKey?: string;
}

export interface NavSectionItem {
  type: 'section';
  label: string;
  items: NavItem[];
}

export type NavItem = NavLinkItem | NavSectionItem;

// Sections ("Marketing", "Operations") are pure navigation containers: they only
// render when at least one of their children is visible. Feature-gated children
// resolve against the Feature Management state, making it the single source of
// truth for navigation visibility.
export const funeralHomeNavigation: NavItem[] = [
  { type: 'link', to: '/dashboard', label: 'Memorials', icon: LayoutDashboard, end: true },
  { type: 'link', to: '/memorials', label: 'All Memorials', icon: LayoutDashboard },
  { type: 'link', to: '/create', label: 'New Memorial', icon: Plus },
  { type: 'link', to: '/billing', label: 'Billing', icon: CreditCard },
  { type: 'link', to: '/profile', label: 'Profile & branding', icon: Building2 },
  {
    type: 'section',
    label: 'Marketing',
    items: [
      { type: 'link', to: '/marketing/brochures', label: 'Digital Brochures', icon: FileText, featureKey: 'BROCHURES' },
      { type: 'link', to: '/marketing/categories', label: 'Categories', icon: Tags, featureKey: 'BROCHURES' },
      { type: 'link', to: '/marketing/promotions', label: 'Promotions', icon: Megaphone, featureKey: 'PROMOTIONS' },
    ],
  },
  {
    type: 'section',
    label: 'Operations',
    items: [
      { type: 'link', to: '/marketing', label: 'Marketing Hub', icon: BarChart3, end: true },
      { type: 'link', to: '/marketing/branches', label: 'Branches', icon: Building2 },
      { type: 'link', to: '/marketing/contact', label: 'Contact Information', icon: Phone },
      { type: 'link', to: '/marketing/enquiries', label: 'Enquiries', icon: MessageSquare },
      { type: 'link', to: '/marketing/analytics', label: 'Analytics', icon: BarChart3 },
      { type: 'link', to: '/vehicles', label: 'Vehicles', icon: Truck, featureKey: 'VEHICLES' },
      { type: 'link', to: '/assets', label: 'Assets', icon: Package, featureKey: 'ASSETS' },
      { type: 'link', to: '/funeral-resources', label: 'Funeral Resources', icon: ClipboardList, featureKey: 'FUNERAL_RESOURCES' },
    ],
  },
];

export const familyNavigation: NavItem[] = [
  { type: 'link', to: '/family', label: 'My Memorials', icon: LayoutDashboard, end: true },
  { type: 'link', to: '/family/memorials', label: 'Assigned Memorials', icon: LayoutDashboard },
];

export const platformNavigation: NavItem[] = [
  { type: 'link', to: '/admin-owner', label: 'Platform Overview', icon: LayoutDashboard, end: true },
  { type: 'link', to: '/admin-owner/funeral-homes', label: 'Funeral Homes', icon: Building2 },
  { type: 'link', to: '/admin-owner/payments', label: 'Payments', icon: CreditCard },
  { type: 'link', to: '/admin-owner/billing', label: 'Billing & Plans', icon: WalletCards },
  { type: 'link', to: '/admin-owner/users', label: 'Users', icon: Users },
  { type: 'link', to: '/admin-owner/support', label: 'Support', icon: LifeBuoy },
  { type: 'link', to: '/admin-owner/analytics', label: 'Analytics', icon: Activity },
  { type: 'link', to: '/admin-owner/revenue', label: 'Revenue Center', icon: BarChart3 },
  { type: 'link', to: '/admin-owner/audit-logs', label: 'Audit Logs', icon: FileClock },
  { type: 'link', to: '/admin-owner/features', label: 'Feature Management', icon: Flag },
];

export function isItemVisible(item: NavItem, hasFeature: (key: string) => boolean): boolean {
  if (item.type === 'link') return !item.featureKey || hasFeature(item.featureKey);
  return item.items.some((child) => isItemVisible(child, hasFeature));
}

export function filterVisibleNavigation(items: NavItem[], hasFeature: (key: string) => boolean): NavItem[] {
  return items
    .filter((item) => isItemVisible(item, hasFeature))
    .map((item) => (item.type === 'section' ? { ...item, items: filterVisibleNavigation(item.items, hasFeature) } : item));
}
