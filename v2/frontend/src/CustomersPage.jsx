// CustomersPage.jsx
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, AlertTriangle, Users, Receipt, FileDown,
  Mail, Star, X, Search, ChevronRight, Clock, Utensils,
  DollarSign, ShoppingBag, ExternalLink, CheckCircle2,
} from 'lucide-react';
import { api } from './api';
import { STATUS_META } from './theme';
import { downloadOrderPDF } from './pdfInvoice';

const AVATAR_PALETTES = [
  { bg: 'from-cyan-500/25 to-blue-500/20', text: 'text-cyan-300', ring: 'border-cyan-400/40' },
  { bg: 'from-rose-500/25 to-pink-500/20', text: 'text-rose-300', ring: 'border-rose-400/40' },
  { bg: 'from-amber-500/25 to-orange-500/20', text: 'text-amber-300', ring: 'border-amber-400/40' },
  { bg: 'from-emerald-500/25 to-teal-500/20', text: 'text-emerald-300', ring: 'border-emerald-400/40' },
  { bg: 'from-purple-500/25 to-indigo-500/20', text: 'text-purple-300', ring: 'border-purple-400/40' },
  { bg: 'from-sky-500/25 to-blue-500/20', text: 'text-sky-300', ring: 'border-sky-400/40' },
];

function getInitials(name) {
  if (!name) return '??';
  const clean = name.trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarStyle(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) {
    hash = (hash + name.charCodeAt(i)) % AVATAR_PALETTES.length;
  }
  return AVATAR_PALETTES[hash];
}

function getHandle(name, email, id) {
  if (email && email.includes('@')) {
    const user = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (user) return `@${user}`;
  }
  if (name) {
    const clean = name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (clean) return `@${clean}`;
  }
  return `@diner_${id}`;
}

function getTierInfo(orderCount, spend) {
  const numOrders = Number(orderCount) || 0;
  const numSpend = Number(spend) || 0;

  if (numOrders >= 3 || numSpend >= 100) {
    return { label: '5.0', tag: 'VIP', color: 'text-amber-300 bg-amber-400/15 border-amber-400/35' };
  }
  if (numOrders >= 1) {
    return { label: '4.8', tag: 'Regular', color: 'text-cyan-300 bg-cyan-400/15 border-cyan-400/35' };
  }
  return { label: '4.6', tag: 'New', color: 'text-zinc-300 bg-white/10 border-white/15' };
}

function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString.replace(' ', 'T') + (isoString.endsWith('Z') ? '' : 'Z'));
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString.replace(' ', 'T') + (isoString.endsWith('Z') ? '' : 'Z'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function CustomersPage({ t, mode, settings = {} }) {
  const [customers, setCustomers]               = useState(() => {
    try {
      const cached = localStorage.getItem('smart_menu_customers_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading]                   = useState(() => {
    try {
      const cached = localStorage.getItem('smart_menu_customers_cache');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });
  const [error, setError]                       = useState(null);
  const [search, setSearch]                     = useState('');
  const [activeFilter, setActiveFilter]         = useState('all'); // 'all' | 'vip' | 'repeat' | 'new'

  // Modal State for Order History & Receipts
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders]     = useState(null);
  const [loadingOrders, setLoadingOrders]       = useState(false);
  const [ordersError, setOrdersError]           = useState(null);

  const bgVideoRef = useRef(null);

  useEffect(() => {
    if (bgVideoRef.current) {
      bgVideoRef.current.muted = true;
      bgVideoRef.current.defaultMuted = true;
      const playPromise = bgVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getCustomers();
      const list = data.customers || [];
      setCustomers(list);
      try {
        localStorage.setItem('smart_menu_customers_cache', JSON.stringify(list));
      } catch {}
    } catch (e) {
      setError(e.message || 'Could not load customers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);

    const handleCustomersUpdated = () => {
      load();
    };
    window.addEventListener('smart_menu_customers_updated', handleCustomersUpdated);
    window.addEventListener('smart_menu_orders_updated', handleCustomersUpdated);

    return () => {
      clearInterval(id);
      window.removeEventListener('smart_menu_customers_updated', handleCustomersUpdated);
      window.removeEventListener('smart_menu_orders_updated', handleCustomersUpdated);
    };
  }, [load]);

  // Open Customer Order History Modal
  const openHistory = async (customer) => {
    setSelectedCustomer(customer);
    setCustomerOrders(null);
    setOrdersError(null);
    setLoadingOrders(true);

    try {
      const data = await api.getCustomerOrders(customer.customer_id);
      setCustomerOrders(data.orders || []);
    } catch (e) {
      setOrdersError(e.message || 'Could not load customer order history.');
    } finally {
      setLoadingOrders(false);
    }
  };

  const closeHistory = () => {
    setSelectedCustomer(null);
    setCustomerOrders(null);
    setOrdersError(null);
  };

  // Metrics
  const stats = useMemo(() => {
    const totalDiners = customers.length;
    const totalOrders = customers.reduce((sum, c) => sum + (Number(c.order_count) || 0), 0);
    const totalRevenue = customers.reduce((sum, c) => sum + (Number(c.lifetime_spend) || 0), 0);
    const vipCount = customers.filter((c) => (c.order_count >= 3 || c.lifetime_spend >= 100)).length;
    return { totalDiners, totalOrders, totalRevenue, vipCount };
  }, [customers]);

  // Filtering
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();

    return customers.filter((c) => {
      // Category Filter
      if (activeFilter === 'vip') {
        const isVip = (c.order_count >= 3 || c.lifetime_spend >= 100);
        if (!isVip) return false;
      } else if (activeFilter === 'repeat') {
        if ((c.order_count || 0) <= 1) return false;
      } else if (activeFilter === 'new') {
        if ((c.order_count || 0) > 0) return false;
      }

      // Search Query Filter
      if (!q) return true;
      const nameMatch = (c.name || '').toLowerCase().includes(q);
      const emailMatch = (c.email || '').toLowerCase().includes(q);
      const idMatch = String(c.customer_id || '').includes(q);
      return nameMatch || emailMatch || idMatch;
    });
  }, [customers, search, activeFilter]);

  return (
    <div className="relative w-full min-h-screen">
      {/* Full-screen Ambient Background Video */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <video
          ref={(el) => {
            bgVideoRef.current = el;
            if (el) {
              el.muted = true;
              el.defaultMuted = true;
              el.play().catch(() => {});
            }
          }}
          src="/videos/PixVerse_full_animation_removed.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedData={(e) => {
            e.currentTarget.muted = true;
            e.currentTarget.play().catch(() => {});
          }}
          className="w-full h-full object-cover"
        />
        {/* Dark vignette overlay for crisp legibility and high contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/35 to-black/60 pointer-events-none" />
      </div>

      {/* Main Page Content Layer */}
      <div className="relative z-10 w-full min-h-screen font-sans px-4 sm:px-8 lg:px-12 py-8 pb-28 max-w-[1700px] mx-auto select-none antialiased">

        {/* Top Header Section */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Customers
            </h1>
            <p className="text-xs sm:text-sm mt-1 text-zinc-400 font-normal">
              {stats.totalDiners} verified diners · built directly from live ordering telemetry
            </p>
          </div>

          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0c0e14]/80 border border-white/10 hover:border-amber-400/40 text-zinc-300 hover:text-amber-400 backdrop-blur-xl text-xs font-semibold tracking-wide transition-all duration-200 cursor-pointer shadow-lg active:scale-95"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin text-amber-400' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Prominent Large Search Bar */}
        <div className="mb-6 space-y-3">
          <div className="relative flex items-center rounded-2xl bg-[#0c0e16]/80 border border-white/10 focus-within:border-amber-400/60 focus-within:shadow-[0_0_25px_rgba(245,158,11,0.25)] backdrop-blur-2xl transition-all duration-200 shadow-xl overflow-hidden">
            <div className="pl-5 pr-2 text-zinc-400 flex items-center pointer-events-none">
              <Search size={20} className="text-amber-400" />
            </div>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers by name, email address, or diner ID..."
              className="w-full bg-transparent py-4 px-2 text-sm sm:text-base text-white placeholder:text-zinc-500 outline-none font-sans font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="pr-5 pl-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                title="Clear search"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Quick Filter Pills Row */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {[
              { key: 'all',    label: `All Guests (${customers.length})` },
              { key: 'vip',    label: `VIP Diners (${stats.vipCount})` },
              { key: 'repeat', label: 'Repeat Guests' },
              { key: 'new',    label: 'New Diners' },
            ].map((f) => {
              const isActive = activeFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`text-xs font-semibold px-4 py-1.5 rounded-full border transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
                    isActive
                      ? 'bg-amber-400 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                      : 'bg-white/5 border-white/10 text-zinc-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border p-4 border-red-500/30 bg-red-500/10">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
            <p className="text-xs text-zinc-300">{error}</p>
          </div>
        )}

        {/* Customer Cards Grid (Matching Reference Design) */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl shadow-2xl">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            </div>
            <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Loading verified customers...</p>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="rounded-[24px] bg-[#08090e]/75 backdrop-blur-2xl border border-white/10 p-16 text-center shadow-xl my-4">
            <Users className="w-10 h-10 mx-auto mb-4 text-zinc-500" />
            <p className="text-sm text-zinc-200 font-semibold mb-1">
              {search.trim() ? 'No Matching Diners Found' : 'No Customer Records Yet'}
            </p>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              {search.trim()
                ? 'Try adjusting your search query or switching active filters.'
                : 'Customer profiles are automatically synthesized as guests place table or service-window orders.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredCustomers.map((customer) => {
              const avatar = getAvatarStyle(customer.name);
              const tier = getTierInfo(customer.order_count, customer.lifetime_spend);
              const handle = getHandle(customer.name, customer.email, customer.customer_id);

              return (
                <div
                  key={customer.customer_id}
                  className="group relative rounded-[22px] bg-[#0c0e16]/80 backdrop-blur-2xl border border-white/[0.10] hover:border-amber-400/50 p-5 shadow-[0_10px_30px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.08)] hover:shadow-[0_0_0_1px_rgba(245,158,11,0.25),0_12px_40px_rgba(0,0,0,0.8)] transition-all duration-300 flex flex-col justify-between overflow-hidden"
                >
                  {/* Specular Top Rim */}
                  <div className="absolute top-0 left-6 right-6 h-[1px] pointer-events-none bg-gradient-to-r from-transparent via-white/15 to-transparent group-hover:via-amber-400/35 transition-colors" />

                  <div>
                    {/* Top Row: Avatar + Name & Handle + Rating/VIP Badge */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div className={`w-11 h-11 rounded-full shrink-0 flex items-center justify-center font-bold text-xs border bg-gradient-to-br ${avatar.bg} ${avatar.text} ${avatar.ring} shadow-md group-hover:scale-105 transition-transform`}>
                          {getInitials(customer.name)}
                        </div>

                        {/* Name & Handle */}
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm sm:text-base text-white truncate group-hover:text-amber-300 transition-colors" title={customer.name}>
                            {customer.name}
                          </h3>
                          <p className="text-xs text-zinc-400 truncate mt-0.5 font-normal">
                            {handle}
                          </p>
                        </div>
                      </div>

                      {/* Rating / Tier Badge */}
                      <div className={`shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-semibold ${tier.color} shadow-sm`}>
                        <Star size={11} className="fill-amber-400 text-amber-400" />
                        <span>{tier.label}</span>
                      </div>
                    </div>

                    {/* Middle Inset Box: Email ID (replacing Specialist) */}
                    <div className="rounded-xl bg-[#06080d]/85 border border-white/[0.06] p-3 mb-3">
                      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Email ID
                      </p>
                      <p className="text-xs sm:text-[13px] font-medium text-zinc-200 truncate" title={customer.email}>
                        {customer.email || 'No email provided'}
                      </p>
                    </div>

                    {/* Bottom Dual Inset Boxes: Total Orders & Spend Money (replacing Clients & Pricing) */}
                    <div className="grid grid-cols-2 gap-2.5 mb-4">
                      {/* Box 1: Total Orders */}
                      <div className="rounded-xl bg-[#06080d]/85 border border-white/[0.06] p-3">
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                          Total Orders
                        </p>
                        <p className="text-base sm:text-lg font-bold text-white tabular-nums">
                          {customer.order_count || 0}
                        </p>
                      </div>

                      {/* Box 2: Spend Money */}
                      <div className="rounded-xl bg-[#06080d]/85 border border-white/[0.06] p-3">
                        <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                          Spend Money
                        </p>
                        <p className="text-base sm:text-lg font-bold text-amber-400 tabular-nums">
                          ${(Number(customer.lifetime_spend) || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Feature Action Button: Order History & Receipts */}
                  <button
                    onClick={() => openHistory(customer)}
                    className="w-full py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 hover:border-amber-400/50 hover:bg-amber-400/10 hover:text-amber-300 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer mt-auto"
                  >
                    <Receipt size={13} className="text-amber-400" />
                    <span>Order History & Receipts</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order History & Receipts Modal / Slide-Over */}
      <AnimatePresence>
        {selectedCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeHistory}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            {/* Modal Dialog Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl bg-[#0a0d14]/95 border border-white/15 shadow-[0_25px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl overflow-hidden z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-400/30 flex items-center justify-center font-bold text-sm text-amber-400 shadow-md">
                    {getInitials(selectedCustomer.name)}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-white truncate">
                      {selectedCustomer.name}
                    </h2>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {selectedCustomer.email || 'No email provided'} · {selectedCustomer.order_count || 0} orders on record
                    </p>
                  </div>
                </div>

                <button
                  onClick={closeHistory}
                  className="p-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Close history"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body / Orders List */}
              <div className="p-6 overflow-y-auto space-y-4 max-h-[calc(90vh-140px)]">
                {loadingOrders ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
                    <p className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Fetching order telemetry...</p>
                  </div>
                ) : ordersError ? (
                  <div className="rounded-xl p-4 bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {ordersError}
                  </div>
                ) : !customerOrders || customerOrders.length === 0 ? (
                  <div className="text-center py-14">
                    <Receipt className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-zinc-300">No Past Orders Found</p>
                    <p className="text-xs text-zinc-500 mt-1">This diner has not finalized any orders yet.</p>
                  </div>
                ) : (
                  customerOrders.map((order) => {
                    const meta = STATUS_META[order.status] || STATUS_META.transmitted;

                    return (
                      <div
                        key={order.order_id}
                        className="rounded-2xl border border-white/10 bg-[#06080d]/80 p-4 space-y-3 hover:border-amber-400/40 transition-all shadow-sm"
                      >
                        {/* Order Header */}
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-white tracking-wide">
                              #{order.order_id}
                            </span>
                            <span className="text-xs text-zinc-400 font-medium">
                              {order.table_id === 'COUNTER' ? '· Pick-up Window' : `· Table ${order.table_id}`}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Status badge */}
                            <span
                              className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-0.5 rounded-full border shadow-sm"
                              style={{
                                backgroundColor: `${meta.color}15`,
                                color: meta.color,
                                borderColor: `${meta.color}35`,
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
                              <span>{meta.label}</span>
                            </span>

                            {/* Download PDF receipt */}
                            <button
                              type="button"
                              onClick={() => downloadOrderPDF(order, settings, 'admin')}
                              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 hover:border-amber-400/40 hover:text-amber-300 text-zinc-300 transition-all flex items-center gap-1 cursor-pointer active:scale-95 shadow-sm"
                              title="Download PDF Receipt"
                            >
                              <FileDown size={12} className="text-amber-400" />
                              <span>Receipt</span>
                            </button>
                          </div>
                        </div>

                        {/* Order Date */}
                        <p className="text-[11px] text-zinc-500 font-normal">
                          {formatDate(order.created_at)} · {formatTime(order.created_at)}
                        </p>

                        {/* Dish List */}
                        <div className="space-y-1.5 border-t border-b border-white/[0.06] py-2.5">
                          {(order.items || []).map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="text-zinc-200">
                                <span className="font-semibold text-amber-400">{item.quantity}×</span> {item.name}
                              </span>
                              <span className="text-zinc-300 font-medium tabular-nums">
                                ${((Number(item.price) || 0) * (item.quantity || 1)).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Chef Notes if any */}
                        {order.notes && (
                          <p className="text-xs text-amber-300/80 italic font-normal">
                            Note: {order.notes}
                          </p>
                        )}

                        {/* Order Total */}
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs text-zinc-400 uppercase tracking-wider font-medium">Order Total</span>
                          <span className="text-sm font-bold text-white tabular-nums">${(Number(order.total) || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default CustomersPage;