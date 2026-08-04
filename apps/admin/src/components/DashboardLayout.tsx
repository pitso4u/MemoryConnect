import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import OwnerTopbar from './platform/OwnerTopbar';
import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import {
  filterVisibleNavigation,
  funeralHomeNavigation,
  familyNavigation,
  platformNavigation,
  NavLinkItem,
  NavSectionItem,
} from '../lib/navigation';

function isFamilyRole(role?: string) {
  return role === 'FAMILY_MANAGER' || role === 'FAMILY_CONTRIBUTOR';
}

export default function DashboardLayout() {
  const { user, logout, hasFeature, refreshFeatures } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const platformOwner = user?.role === 'SUPER_ADMIN';
  const baseNavigation = platformOwner ? platformNavigation : isFamilyRole(user?.role) ? familyNavigation : funeralHomeNavigation;

  const navigation = useMemo(
    () => filterVisibleNavigation(baseNavigation, hasFeature),
    [baseNavigation, hasFeature],
  );

  // Refetch feature availability on every route change so a platform owner's
  // flag toggle is picked up immediately on the next navigation, not just on the
  // polling interval.
  useEffect(() => {
    if (user) void refreshFeatures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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

  const renderLink = (item: NavLinkItem) => {
    const { to, label, icon: Icon, end } = item;
    return (
      <NavLink
        key={to}
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
    );
  };

  const renderSection = (section: NavSectionItem) => {
    const isCollapsed = collapsed.has(section.label);
    return (
      <div key={section.label}>
        <div className="px-3 pb-1 pt-4">
          <button
            type="button"
            onClick={() => toggleSection(section.label)}
            className="flex w-full items-center gap-1.5 text-left"
            aria-expanded={!isCollapsed}
          >
            <ChevronDown
              size={14}
              className={`shrink-0 text-parchment/40 transition-transform duration-200 ${
                isCollapsed ? '-rotate-90' : ''
              }`}
            />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-parchment/40">{section.label}</p>
          </button>
        </div>
        <div
          className={`overflow-hidden transition-all duration-200 ${
            isCollapsed ? 'max-h-0 opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {section.items.map((child) => (child.type === 'section' ? renderSection(child) : renderLink(child)))}
        </div>
      </div>
    );
  };

  const navItems = (mobile = false) => {
    return (
      <nav className={mobile ? 'space-y-1 px-4 py-4' : 'flex-1 space-y-1 p-4'} aria-label={mobile ? 'Mobile admin navigation' : 'Admin navigation'}>
        {navigation.map((item) => (item.type === 'section' ? renderSection(item) : renderLink(item)))}
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
        {platformOwner && <OwnerTopbar />}
        <Outlet />
      </main>
    </div>
  );
}
