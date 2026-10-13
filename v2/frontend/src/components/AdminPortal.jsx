// AdminPortal.jsx
import React, { useMemo, useState, useEffect, createContext, useContext } from 'react';
import AdminLayout from '../AdminLayout';
import DashboardPage from '../DashboardPage';
import TablesPage from '../TablesPage';
import OrdersPage from '../OrdersPage';
import CustomersPage from '../CustomersPage';
import SettingsPage from '../SettingsPage';
import { getTheme } from '../theme';
import { api } from '../api';
import { initRealtime } from '../realtime';

// ── Global settings context ───────────────────────────────────────────────
export const SettingsContext = createContext({});
export const useSettings = () => useContext(SettingsContext);

const PAGE_META = {
  dashboard:  { search: false },
  tables:     { search: false },
  orders:     { search: false },
  customers:  { search: false },
  settings:   { search: false },
};

function AdminPortal() {
  const [mode, setMode]           = useState('jet');
  const [activeNav, setActiveNav] = useState(() => {
    const p = typeof window !== 'undefined' ? window.location.pathname : '';
    if (p.includes('/admin/tables')) return 'tables';
    if (p.includes('/admin/orders')) return 'orders';
    if (p.includes('/admin/customers')) return 'customers';
    if (p.includes('/admin/settings')) return 'settings';
    return 'dashboard';
  });
  const [customerSearch, setCustomerSearch] = useState('');
  const [settings, setSettings]   = useState(() => {
    try {
      const cached = localStorage.getItem('smart_menu_settings_cache');
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });
  const [orders, setOrders]       = useState(() => {
    try {
      const cached = localStorage.getItem('smart_menu_orders_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [selectedOrderTarget, setSelectedOrderTarget] = useState(null);

  const handleNavigate = (navKey) => {
    setActiveNav(navKey);
    const targetPath = navKey === 'dashboard' ? '/admin' : `/admin/${navKey}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
  };

  const handleOrderClick = (orderId) => {
    setSelectedOrderTarget(orderId);
    handleNavigate('orders');
  };

  useEffect(() => {
    const handlePopState = () => {
      const p = window.location.pathname;
      if (p.includes('/admin/tables')) setActiveNav('tables');
      else if (p.includes('/admin/orders')) setActiveNav('orders');
      else if (p.includes('/admin/customers')) setActiveNav('customers');
      else if (p.includes('/admin/settings')) setActiveNav('settings');
      else if (p.startsWith('/admin')) setActiveNav('dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const t    = useMemo(() => getTheme(mode, settings.default_theme), [mode, settings.default_theme]);
  const meta = PAGE_META[activeNav] || { search: false };

  // Load settings once on mount so every page has access.
  useEffect(() => {
    api.getSettings()
      .then((s) => {
        if (s) {
          setSettings(s);
          try {
            localStorage.setItem('smart_menu_settings_cache', JSON.stringify(s));
          } catch {}
        }
      })
      .catch(() => {/* non-blocking */});
  }, []);

  // Poll orders periodically so the notification bell is always up-to-date
  const fetchOrders = React.useCallback(async () => {
    try {
      const data = await api.getOrders();
      if (data && Array.isArray(data.orders)) {
        setOrders(data.orders);
        try {
          localStorage.setItem('smart_menu_orders_cache', JSON.stringify(data.orders));
        } catch {}
      }
    } catch {
      // non-blocking
    }
  }, []);

  const handleOrderHandled = React.useCallback((orderId, status) => {
    if (orderId && status) {
      setOrders((prev) => {
        const next = prev.map((o) => (o.order_id === orderId ? { ...o, status } : o));
        try {
          localStorage.setItem('smart_menu_orders_cache', JSON.stringify(next));
        } catch {}
        return next;
      });
    } else {
      fetchOrders();
    }
  }, [fetchOrders]);

  useEffect(() => {
    fetchOrders();
    const cleanupRealtime = initRealtime();
    const interval = setInterval(fetchOrders, 3000);

    const handleOrdersUpdated = (e) => {
      if (e?.detail?.orderId && e?.detail?.status) {
        setOrders((prev) => {
          const next = prev.map((o) =>
            o.order_id === e.detail.orderId ? { ...o, status: e.detail.status } : o
          );
          try {
            localStorage.setItem('smart_menu_orders_cache', JSON.stringify(next));
          } catch {}
          return next;
        });
      } else {
        fetchOrders();
      }
    };
    window.addEventListener('smart_menu_orders_updated', handleOrdersUpdated);

    return () => {
      clearInterval(interval);
      cleanupRealtime?.();
      window.removeEventListener('smart_menu_orders_updated', handleOrdersUpdated);
    };
  }, [fetchOrders]);

  // Compute active incomplete orders (orders waiting to be served)
  const incompleteOrders = useMemo(() => {
    return orders.filter(
      (o) => o.status !== 'served' && o.status !== 'cancelled'
    );
  }, [orders]);

  const renderPage = () => {
    switch (activeNav) {
      case 'dashboard':
        return <DashboardPage t={t} mode={mode} onNavigate={handleNavigate} settings={settings} />;
      case 'tables':
        return <TablesPage t={t} mode={mode} settings={settings} />;
      case 'orders':
        return (
          <OrdersPage
            t={t}
            mode={mode}
            settings={settings}
            initialSelectedOrderId={selectedOrderTarget}
            onClearSelectedOrder={() => setSelectedOrderTarget(null)}
            onOrderHandled={handleOrderHandled}
          />
        );
      case 'customers':
        return (
          <CustomersPage t={t} mode={mode} settings={settings} />
        );
      case 'settings':
        return (
          <SettingsPage
            t={t}
            onSaved={(updated) => {
              setSettings(updated);
              try {
                localStorage.setItem('smart_menu_settings_cache', JSON.stringify(updated));
              } catch {}
              window.dispatchEvent(new CustomEvent('smart_menu_settings_updated', { detail: updated }));
            }}
            onThemeChange={(default_theme) => setSettings((current) => ({ ...current, default_theme }))}
          />
        );
      default:
        return <DashboardPage t={t} mode={mode} onNavigate={handleNavigate} />;
    }
  };

  return (
    <SettingsContext.Provider value={settings}>
      <AdminLayout
        activeNav={activeNav}
        onNavigate={handleNavigate}
        mode={mode}
        setMode={setMode}
        themeName={settings.default_theme}
        restaurantName={settings.restaurant_name}
        searchValue={meta.search ? customerSearch : undefined}
        onSearchChange={meta.search ? setCustomerSearch : undefined}
        searchPlaceholder={meta.placeholder}
        incompleteOrders={incompleteOrders}
        onOrderClick={handleOrderClick}
      >
        {renderPage()}
      </AdminLayout>
    </SettingsContext.Provider>
  );
}

export default AdminPortal;
