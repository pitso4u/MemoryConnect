import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { Activity, BarChart3, Building2, ChevronDown, ClipboardList, CreditCard, FileClock, FileText, Flag, LayoutDashboard, LifeBuoy, LogOut, Megaphone, Menu, MessageSquare, Package, Phone, Plus, Tags, Truck, Users, WalletCards, X } from 'lucide-react';

interface NavLinkItem { type: 'link'; to: string; label: string; icon: React.ComponentType<{ size?: number }>; end?: boolean; featureKey?: string }
interface NavHeaderItem { type: 'header'; label: string }
type NavItem = NavLinkItem | NavHeaderItem;

const funeralHomeNavigation: NavItem[] = [
  { type: 'link', to: '/dashboard', label: 'Memorials', icon: LayoutDashboard, end: true },
  { type: 'link', to: '/memorials', label: 'All Memorials', icon: LayoutDashboard },
  { type: 'link', to: '/create', label: 'New Memorial', icon: Plus },
  { type: 'link', to: '/billing', label: 'Billing', icon: CreditCard },
  { type: 'link', to: '/profile', label: 'Profile & branding', icon: Building2 },
  { type: 'header', label: 'Marketing' },
  { type: 'link', to: '/marketing', label: 'Dashboard', icon: BarChart3, end: true },
  { type: 'link', to: '/marketing/brochures', label: 'Digital Brochures', icon: FileText, featureKey: 'BROCHURES' },
  { type: 'link', to: '/marketing/categories', label: 'Categories', icon: Tags, featureKey: 'BROCHURES' },
  { type: 'link', to: '/marketing/promotions', label: 'Promotions', icon: Megaphone, featureKey: 'PROMOTIONS' },
  { type: 'link', to: '/marketing/branches', label: 'Branches', icon: Building2 },
  { type: 'link', to: '/marketing/contact', label: 'Contact Information', icon: Phone },
  { type: 'link', to: '/marketing/enquiries', label: 'Enquiries', icon: MessageSquare },
  { type: 'link', to: '/marketing/analytics', label: 'Analytics', icon: BarChart3 },
  { type: 'header', label: 'Operations' },
  { type: 'link', to: '/vehicles', label: 'Vehicles', icon: Truck, featureKey: 'VEHICLES' },
  { type: 'link', to: '/assets', label: 'Assets', icon: Package, featureKey: 'ASSETS' },
  { type: 'link', to: '/funeral-resources', label: 'Funeral Resources', icon: ClipboardList, featureKey: 'FUNERAL_RESOURCES' },
];

const familyNavigation: NavItem[] = [
  { type: 'link', to: '/family', label: 'My Memorials', icon: LayoutDashboard, end: true },
  { type: 'link', to: '/family/memorials', label: 'Assigned Memorials', icon: LayoutDashboard },
];

const platformNavigation: NavItem[] = [
  { type: 'link', to: '/admin-owner', label: 'Platform Overview', icon: LayoutDashboard, end: true },
  { type: 'link', to: '/admin-owner/funeral-homes', label: 'Funeral Homes', icon: Building2 },
  { type: 'link', to: '/admin-owner/payments', label: 'Payments', icon: CreditCard },
  { type: 'link', to: '/admin-owner/billing', label: 'Billing & Plans', icon: WalletCards },
  { type: 'link', to: '/admin-owner/users', label: 'Users', icon: Users },
  { type: 'link', to: '/admin-owner/support', label: 'Support', icon: LifeBuoy },
  { type: 'link', to: '/admin-owner/analytics', label: 'Analytics', icon: Activity },
  { type: 'link', to: '/admin-owner/audit-logs', label: 'Audit Logs', icon: FileClock },
  { type: 'link', to: '/admin-owner/features', label: 'Feature Management', icon: Flag },
];

function isFamilyRole(role?: string) {
  return role === 'FAMILY_MANAGER' || role === 'FAMILY_CONTRIBUTOR';
}

export default function DashboardLayout() {
  const { user, logout, hasFeature } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const platformOwner = user?.role === 'SUPER_ADMIN';
  const baseNavigation = platformOwner ? platformNavigation : isFamilyRole(user?.role) ? familyNavigation : funeralHomeNavigation;

  const navigation = useMemo(() => {
    const visible = baseNavigation.filter((item) =>
      item.type === 'link' ? !item.featureKey || hasFeature(item.featureKey) : true,
    );
    return visible.filter((item, index, arr) => {
      if (item.type !== 'header') return true;
      const rest = arr.slice(index + 1);
      const nextHeader = rest.findIndex((candidate) => candidate.type === 'header');
      const links = nextHeader === -1 ? rest : rest.slice(0, nextHeader);
      return links.length > 0;
    });
  }, [baseNavigation, hasFeature]);

  const portalLabel = platformOwner ? 'Platform Owner' : isFamilyRole(user?.role) ? 'Family Portal' : 'Admin Portal';
  const portalName = platformOwner ? 'Memory Connect' : brand.tradingName || brand.companyName;
  const portalLogo = platformOwner ? '/brand/memory-connect-logo-horizontal.png' : brand.logoUrl;

  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('mc_collapsed_sections');
      return new Set(saved ? JSON.parse(saved) : []);
    } catch { return new Set<string>(); }
  });

  const toggleSection = useCallback((label: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label); else next.add(label);
      try { localStorage.setItem('mc_collapsed_sections', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = (mobile = false) => {
    let currentSection: string | null = null;
    return (
      <nav className={mobile ? 'space-y-1 px-4 py-4' : 'flex-1 space-y-1 p-4'} aria-label={mobile ? 'Mobile admin navigation' : 'Admin navigation'}>
        {navigation.map((item) => {
          if (item.type === 'header') {
            currentSection = item.label;
            const isCollapsed = collapsed.has(item.label);
            return (
              <div key={item.label} className="px-3 pb-1 pt-4">
                <button
                  type="button"
                  onClick={() => toggleSection(item.label)}
                  className="flex w-full items-center gap-1.5 text-left"
                  aria-expanded={!isCollapsed}
                >
                  <ChevronDown
                    size={14}
                    className={`shrink-0 text-parchment/40 transition-transform duration-200 ${
                      isCollapsed ? '-rotate-90' : ''
                    }`}
                  />
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-parchment/40">{item.label}</p>
                </button>
              </div>
            );
          }
          const { to, label, icon: Icon, end } = item;
          const isHidden = currentSection && collapsed.has(currentSection);
          return (
            <div
              key={to}
              className={`overflow-hidden transition-all duration-200 ${
                isHidden ? 'max-h-0 opacity-0 pointer-events-none' : 'max-h-12 opacity-100'
              }`}
            >
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    isActive ? 'bg-white/12 text-white' : 'text-parchment/80 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                {label}
              </NavLink>
            </div>
          );
        })}
      </nav>
    );
  };

  return (
    <div className="min-h-screen md:flex">
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-[var(--brand-primary)] px-4 text-[var(--brand-secondary)] shadow-sm md:hidden">
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight">{portalName}</p>
          <p className="text-[11px] opacity-60">{portalLabel}</p>
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className="grid size-11 place-items-center rounded-lg border border-white/15 text-parchment transition hover:bg-white/10"
          aria-label={menuOpen ? 'Close admin menu' : 'Open admin menu'}
          aria-expanded={menuOpen}
          aria-controls="mobile-admin-menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {menuOpen && (
        <div id="mobile-admin-menu" className="fixed inset-x-0 bottom-0 top-16 z-30 bg-[var(--brand-primary)] text-[var(--brand-secondary)] md:hidden">
          <div className="flex h-full flex-col overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {navItems(true)}
            <div className="mt-auto border-t border-white/10 p-4">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-parchment/50">{user?.email}</p>
              <button type="button" onClick={handleLogout} className="mt-3 flex min-h-11 items-center gap-2 text-sm text-parchment/70 transition hover:text-parchment">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-[var(--brand-primary)] text-[var(--brand-secondary)] md:flex">
        <div className="border-b border-white/10 p-6">
          {portalLogo ? <img src={portalLogo} alt={`${portalName} logo`} className="mb-3 max-h-12 max-w-44 rounded bg-white/95 p-1 object-contain" /> : null}
          <h1 className="font-display text-xl">{portalName}</h1>
          <p className="mt-1 text-xs text-parchment/50">{portalLabel}</p>
          {!platformOwner && !brand.whiteLabelEnabled && <p className="mt-1 text-[11px] text-parchment/35">Powered by Memory Connect</p>}
        </div>
        {navItems()}
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="truncate text-xs text-parchment/50">{user?.email}</p>
          <button type="button" onClick={handleLogout} className="mt-3 flex items-center gap-2 text-sm text-parchment/60 transition hover:text-parchment">
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
