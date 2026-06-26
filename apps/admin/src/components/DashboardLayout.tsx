import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Plus, LayoutDashboard } from 'lucide-react';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex">
      <aside className="w-64 bg-ink text-parchment flex flex-col">
        <div className="p-6 border-b border-white/10">
          <h1 className="font-display text-xl">MemorialConnect</h1>
          <p className="text-xs text-parchment/50 mt-1">Admin Portal</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition text-sm"
          >
            <LayoutDashboard size={18} />
            Memorials
          </Link>
          <Link
            to="/create"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/10 transition text-sm"
          >
            <Plus size={18} />
            New Memorial
          </Link>
        </nav>

        <div className="p-4 border-t border-white/10">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-xs text-parchment/50 truncate">{user?.email}</p>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 mt-3 text-sm text-parchment/60 hover:text-parchment transition"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
