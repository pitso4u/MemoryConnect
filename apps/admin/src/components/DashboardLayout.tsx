import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBrand } from '../context/BrandContext';
import { Activity, Building2, CreditCard, FileClock, LayoutDashboard, LifeBuoy, LogOut, Menu, Plus, Users, X } from 'lucide-react';

const funeralHomeNavigation = [
  { to: '/dashboard', label: 'Memorials', icon: LayoutDashboard, end: true },
  { to: '/memorials', label: 'All Memorials', icon: LayoutDashboard },
  { to: '/create', label: 'New Memorial', icon: Plus },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/profile', label: 'Profile & branding', icon: Building2 },
];

const familyNavigation = [
  { to: '/family', label: 'My Memorials', icon: LayoutDashboard, end: true },
  { to: '/family/memorials', label: 'Assigned Memorials', icon: LayoutDashboard },
];

const platformNavigation = [
  { to: '/admin-owner', label: 'Platform Overview', icon: LayoutDashboard, end: true },
  { to: '/admin-owner/funeral-homes', label: 'Funeral Homes', icon: Building2 },
  { to: '/admin-owner/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin-owner/users', label: 'Users', icon: Users },
  { to: '/admin-owner/support', label: 'Support', icon: LifeBuoy },
  { to: '/admin-owner/analytics', label: 'Analytics', icon: Activity },
  { to: '/admin-owner/audit-logs', label: 'Audit Logs', icon: FileClock },
];

function isFamilyRole(role?: string) {
  return role === 'FAMILY_MANAGER' || role === 'FAMILY_CONTRIBUTOR';
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const { brand } = useBrand();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const platformOwner = user?.role === 'SUPER_ADMIN';
  const navigation = platformOwner ? platformNavigation : isFamilyRole(user?.role) ? familyNavigation : funeralHomeNavigation;
  const portalLabel = platformOwner ? 'Platform Owner' : isFamilyRole(user?.role) ? 'Family Portal' : 'Admin Portal';
  const portalName = platformOwner ? 'Memory Connect' : brand.tradingName || brand.companyName;

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = (mobile = false) => (
    <nav className={mobile ? 'space-y-1 px-4 py-4' : 'flex-1 space-y-1 p-4'} aria-label={mobile ? 'Mobile admin navigation' : 'Admin navigation'}>
      {navigation.map(({ to, label, icon: Icon, end }) => (
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
      ))}
    </nav>
  );

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
          {brand.logoUrl ? <img src={brand.logoUrl} alt={`${brand.companyName} logo`} className="mb-3 max-h-12 max-w-44 object-contain" /> : null}
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
