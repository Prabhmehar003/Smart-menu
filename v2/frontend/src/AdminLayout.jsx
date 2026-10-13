import React, { useMemo, useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Settings,
  Users,
  Receipt,
  LogOut,
  Table2,
  Search,
  Bell,
  UtensilsCrossed,
} from 'lucide-react';
import { getTheme } from './theme';
import { api } from './api';
import PersonalInfoModal from './components/PersonalInfoModal';
import NotificationsModal from './components/NotificationsModal';

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/admin',
  },
  {
    key: 'tables',
    label: 'Tables & QRs',
    icon: Table2,
    path: '/admin/tables',
  },
  {
    key: 'orders',
    label: 'Orders',
    icon: Receipt,
    path: '/admin/orders',
  },
  {
    key: 'customers',
    label: 'Customers',
    icon: Users,
    path: '/admin/customers',
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/admin/settings',
  },
];

export { NAV_ITEMS };
function AdminLayout({
  activeNav,
  onNavigate,
  mode,
  setMode,
  themeName,
  restaurantName = 'SMART MENU',
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  incompleteOrders = [],
  onOrderClick,
  children,
}) {
  const t = useMemo(() => getTheme(mode, themeName), [mode, themeName]);

  const [showPersonalModal, setShowPersonalModal] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const stored = localStorage.getItem('acid_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Fetch fresh profile from backend on mount
  useEffect(() => {
    api.getMe()
      .then((res) => {
        if (res?.user) {
          setUserProfile(res.user);
          try {
            localStorage.setItem('acid_session', JSON.stringify(res.user));
          } catch (_) {}
        }
      })
      .catch(() => {});
  }, []);

  const handleUserUpdated = (updated) => {
    setUserProfile(updated);
  };

  const initials = useMemo(() => {
    const name = userProfile?.name || 'Admin';
    const parts = name.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return 'AC';
  }, [userProfile?.name]);

  const displayShortName = useMemo(() => {
    if (userProfile?.name) {
      return userProfile.name.split(' ')[0].toUpperCase();
    }
    return 'ADMIN';
  }, [userProfile?.name]);

  const handleSignOut = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#050508] text-white font-sans relative selection:bg-amber-400 selection:text-black">
      {/* =================================================
          COMPACT FLOATING VERTICAL NAVIGATION RAIL (Desktop)
      ================================================= */}
      <aside
        className="hidden lg:flex flex-col w-[76px] shrink-0 fixed top-0 bottom-0 left-0 z-50 bg-[#07080d]/80 backdrop-blur-2xl border-r border-white/10 py-6 items-center justify-between shadow-2xl select-none"
      >
        {/* Brand Logo & Tooltip */}
        <div className="relative group flex items-center justify-center">
          <button
            onClick={() => onNavigate('dashboard')}
            className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-amber-400/30 to-amber-200/10 border border-amber-500/35 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.2)] hover:border-amber-400/60 hover:scale-105 transition-all duration-200 cursor-pointer"
          >
            <UtensilsCrossed size={19} className="text-amber-400" />
          </button>

          {/* Floating Tooltip */}
          <div className="absolute left-16 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-[#0c0e14]/90 backdrop-blur-xl text-white text-[11px] font-mono tracking-wider font-bold whitespace-nowrap border border-white/15 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 shadow-xl z-50">
            <span className="text-amber-400 font-black">{restaurantName}</span>
            <span className="text-zinc-400 text-[9px] block">Restaurant OS</span>
          </div>
        </div>

        {/* Center: Vertical Navigation Icons */}
        <nav className="flex flex-col items-center gap-3 w-full px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.key;

            return (
              <div key={item.key} className="relative group w-full flex justify-center">
                <button
                  type="button"
                  onClick={() => onNavigate(item.key)}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black shadow-[0_0_22px_rgba(245,158,11,0.4)] scale-105 font-bold'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10 hover:border hover:border-white/15'
                  }`}
                >
                  <Icon size={19} />
                </button>

                {/* Floating Tooltip */}
                <div className="absolute left-16 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-[#0c0e14]/90 backdrop-blur-xl text-white text-[11px] font-mono tracking-wider font-semibold whitespace-nowrap border border-white/15 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 shadow-xl z-50">
                  {item.label}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom: Sign Out Button */}
        <div className="relative group flex items-center justify-center">
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-[#FF3B3B] hover:bg-[#FF3B3B]/10 hover:border hover:border-[#FF3B3B]/25 transition-all duration-200 cursor-pointer"
          >
            <LogOut size={18} />
          </button>

          {/* Floating Tooltip */}
          <div className="absolute left-16 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl bg-[#0c0e14]/90 backdrop-blur-xl text-white text-[11px] font-mono tracking-wider font-semibold whitespace-nowrap border border-white/15 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200 shadow-xl z-50">
            Sign out to Landing Page
          </div>
        </div>
      </aside>

      {/* =================================================
          MAIN CONTENT AREA (Offset by compact rail)
      ================================================= */}
      <div className="lg:pl-[76px] flex flex-col min-h-screen">
        {/* Floating Top Bar (Controls for Search, Theme, Notifications, Profile) */}
        <header className="sticky top-0 z-40 px-6 py-4 flex items-center justify-between gap-4 pointer-events-none">
          {/* Left: Optional search or breadcrumb pill */}
          <div className="pointer-events-auto">
            {onSearchChange ? (
              <div className="relative w-full max-w-xs">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400"
                />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full bg-[#0c0e14]/75 backdrop-blur-xl border border-white/15 rounded-full py-2 pl-9 pr-4 text-xs font-mono text-white placeholder:text-zinc-500 outline-none focus:border-amber-400/50 transition-all shadow-lg"
                />
              </div>
            ) : null}
          </div>

          {/* Right: Floating Glass Controls */}
          <div className="flex items-center gap-2.5 pointer-events-auto shrink-0">
            {/* Notifications Button */}
            <button
              type="button"
              onClick={() => setShowNotificationsModal(true)}
              aria-label="Notifications"
              title={incompleteOrders.length > 0 ? `${incompleteOrders.length} active incomplete order${incompleteOrders.length === 1 ? '' : 's'}` : "No incomplete orders"}
              className="w-9 h-9 rounded-full bg-[#0c0e14]/70 backdrop-blur-xl border border-white/10 hover:border-amber-400/40 flex items-center justify-center relative hover:bg-white/10 transition-all duration-200 shadow-lg cursor-pointer active:scale-95 group"
            >
              <Bell size={14} className={`transition-colors ${incompleteOrders.length > 0 ? 'text-amber-300' : 'text-zinc-300 group-hover:text-white'}`} />
              {incompleteOrders.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF3B3B] shadow-[0_0_8px_#FF3B3B] animate-pulse ring-2 ring-[#0c0e14]" />
              )}
            </button>

            {/* Profile Avatar Pill - Clickable to open Personal Info Modal */}
            <button
              type="button"
              onClick={() => setShowPersonalModal(true)}
              className="h-9 px-3 rounded-full bg-[#0c0e14]/70 backdrop-blur-xl border border-white/10 hover:border-amber-400/40 hover:bg-white/10 flex items-center gap-2 shadow-lg transition-all duration-200 cursor-pointer active:scale-95 group"
              title="Click to view & edit personal profile"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 text-black font-mono text-[10px] font-black flex items-center justify-center shadow-[0_0_10px_rgba(245,158,11,0.3)] group-hover:shadow-[0_0_15px_rgba(245,158,11,0.5)] overflow-hidden">
                {userProfile?.avatar_url ? (
                  <img
                    src={userProfile.avatar_url}
                    alt={displayShortName}
                    className="w-full h-full object-cover rounded-full"
                  />
                ) : (
                  initials
                )}
              </div>
              <span className="hidden md:inline font-mono text-xs font-bold text-white tracking-wider group-hover:text-amber-300 transition-colors uppercase">
                {displayShortName}
              </span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 w-full min-w-0">
          {children}
        </main>

        {/* =================================================
            MOBILE BOTTOM FLOATING DOCK (< 1024px)
        ================================================= */}
        <nav
          className="lg:hidden fixed bottom-3 left-4 right-4 z-50 bg-[#07080d]/90 backdrop-blur-2xl border border-white/15 px-3 py-2 rounded-2xl flex items-center justify-around shadow-2xl"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onNavigate(item.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl font-mono text-[9px] font-bold tracking-wide transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Icon size={16} />
                <span>{item.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Personal Info Profile Modal */}
      <PersonalInfoModal
        isOpen={showPersonalModal}
        onClose={() => setShowPersonalModal(false)}
        user={userProfile}
        onUserUpdated={handleUserUpdated}
      />

      {/* Incomplete Orders Notifications Modal */}
      <NotificationsModal
        isOpen={showNotificationsModal}
        onClose={() => setShowNotificationsModal(false)}
        orders={incompleteOrders}
        onOrderClick={(orderId) => {
          if (onOrderClick) {
            onOrderClick(orderId);
          } else if (onNavigate) {
            onNavigate('orders');
          }
        }}
        onViewAllOrders={() => {
          if (onNavigate) {
            onNavigate('orders');
          }
        }}
      />
    </div>
  );
}

export default AdminLayout;