// OrdersPage.jsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, AlertTriangle, Clock, MessageSquare,
  ChevronRight, ChevronDown, Receipt, FileDown,
  Calendar, ArrowUpDown, ArrowUp, ArrowDown, Utensils,
  ChevronLeft, X, Search, SlidersHorizontal, Check, CheckCircle2
} from 'lucide-react';
import { api } from './api';
import { STATUS_META, ORDER_STATUS_FLOW } from './theme';
import { downloadOrderPDF } from './pdfInvoice';

const STATUS_DISPLAY_NAMES = {
  transmitted: 'Pending',
  preparing: 'In Progress',
  ready: 'Ready',
  served: 'Completed',
  cancelled: 'Cancelled',
};

function nextStatus(current) {
  const idx = ORDER_STATUS_FLOW.indexOf(current);
  if (idx === -1 || idx === ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[idx + 1];
}

function parseOrderDate(dateInput) {
  if (!dateInput) return null;
  let d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    const str = String(dateInput).trim().replace(' ', 'T');
    d = new Date(str.endsWith('Z') ? str : str + 'Z');
  }
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(dateInput) {
  const d = parseOrderDate(dateInput);
  if (!d) return '—';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateInput) {
  const d = parseOrderDate(dateInput);
  if (!d) return '';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatToday() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function getTableBadge(order) {
  const isTakeaway = order.table_id === 'COUNTER' || !order.table_id || String(order.table_id).toLowerCase() === 'takeaway';
  if (isTakeaway) {
    return {
      text: 'SW',
      isTakeaway: true,
      label: 'Service Window',
      bgClass: 'bg-amber-500/15 border border-amber-400/40 text-amber-300 font-extrabold shadow-[0_0_16px_rgba(245,158,11,0.18)]',
    };
  }
  const cleanTable = String(order.table_id).replace(/^table\s*/i, '').trim();
  const display = cleanTable.length <= 3 ? cleanTable : `T${cleanTable}`;
  return {
    text: display,
    isTakeaway: false,
    label: `Table ${cleanTable}`,
    tableNumber: cleanTable,
    bgClass: 'bg-teal-500/15 border border-teal-500/40 text-teal-300 font-bold shadow-[0_0_16px_rgba(20,184,166,0.15)]',
  };
}

function OrdersPage({ t, mode, settings = {}, initialSelectedOrderId, onClearSelectedOrder, onOrderHandled }) {
  const [orders, setOrders] = useState(() => {
    try {
      const cached = localStorage.getItem('smart_menu_orders_cache');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('smart_menu_orders_cache');
      return !cached || JSON.parse(cached).length === 0;
    } catch {
      return true;
    }
  });

  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('process'); // 'all' | 'process' | 'completed' | 'cancelled'
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('date'); // 'id' | 'name' | 'date' | 'price'
  const [sortOrder, setSortOrder] = useState('desc'); // 'asc' | 'desc'
  const [expandedCardItems, setExpandedCardItems] = useState({});
  const [modalOrder, setModalOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;
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

  // Load orders from API
  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getOrders({});
      const list = data.orders || [];
      setOrders(list);
      try {
        localStorage.setItem('smart_menu_orders_cache', JSON.stringify(list));
      } catch {}
    } catch (e) {
      setError(e.message || 'Could not load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 3000);

    const handleOrdersUpdated = () => {
      load();
    };
    window.addEventListener('smart_menu_orders_updated', handleOrdersUpdated);

    return () => {
      clearInterval(id);
      window.removeEventListener('smart_menu_orders_updated', handleOrdersUpdated);
    };
  }, [load]);

  const handleAdvance = (orderId, status) => {
    setUpdatingId(orderId);
    const prevOrders = orders;
    const updatedOrders = orders.map((o) =>
      o.order_id === orderId ? { ...o, status } : o
    );
    setOrders(updatedOrders);
    try {
      localStorage.setItem('smart_menu_orders_cache', JSON.stringify(updatedOrders));
    } catch {}

    window.dispatchEvent(
      new CustomEvent('smart_menu_orders_updated', {
        detail: { orderId, status },
      })
    );
    if (onOrderHandled) onOrderHandled(orderId, status);

    api.updateOrderStatus(orderId, status)
      .catch((e) => {
        setError(e.message || 'Could not update order.');
        setOrders(prevOrders);
        try {
          localStorage.setItem('smart_menu_orders_cache', JSON.stringify(prevOrders));
        } catch {}
        window.dispatchEvent(new CustomEvent('smart_menu_orders_updated'));
        if (onOrderHandled) onOrderHandled();
      })
      .finally(() => {
        setUpdatingId(null);
        if (modalOrder && modalOrder.order_id === orderId) {
          setModalOrder((prev) => (prev ? { ...prev, status } : null));
        }
      });
  };

  const handleCancel = (orderId) => handleAdvance(orderId, 'cancelled');

  const toggleCardItems = (orderId, e) => {
    if (e) e.stopPropagation();
    setExpandedCardItems((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  // Status counts for badge indicators
  const counts = useMemo(() => {
    const c = { all: orders.length, process: 0, completed: 0, cancelled: 0 };
    orders.forEach((o) => {
      if (o.status === 'transmitted' || o.status === 'preparing' || o.status === 'ready') {
        c.process += 1;
      } else if (o.status === 'served') {
        c.completed += 1;
      } else if (o.status === 'cancelled') {
        c.cancelled += 1;
      }
    });
    return c;
  }, [orders]);

  // Filter & Search & Sort
  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        // Tab filter
        if (activeTab === 'process') {
          if (o.status !== 'transmitted' && o.status !== 'preparing' && o.status !== 'ready') return false;
        } else if (activeTab === 'completed') {
          if (o.status !== 'served') return false;
        } else if (activeTab === 'cancelled') {
          if (o.status !== 'cancelled') return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchCust = (o.customer_name || '').toLowerCase().includes(q);
          const matchId = String(o.order_id).toLowerCase().includes(q);
          const matchTable = String(o.table_id || '').toLowerCase().includes(q);
          const matchItems = (o.items || []).some((it) => (it.name || '').toLowerCase().includes(q));
          if (!matchCust && !matchId && !matchTable && !matchItems) return false;
        }

        // Date range filter
        if (startDate || endDate) {
          const d = parseOrderDate(o.created_at);
          if (!d) return true;
          const orderDayStr = d.toISOString().split('T')[0];
          if (startDate && orderDayStr < startDate) return false;
          if (endDate && orderDayStr > endDate) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'id') {
          const numA = parseInt(String(a.order_id).replace(/\D/g, ''), 10) || 0;
          const numB = parseInt(String(b.order_id).replace(/\D/g, ''), 10) || 0;
          diff = numA - numB;
        } else if (sortBy === 'name') {
          diff = (a.customer_name || '').localeCompare(b.customer_name || '');
        } else if (sortBy === 'date') {
          const timeA = parseOrderDate(a.created_at)?.getTime() || 0;
          const timeB = parseOrderDate(b.created_at)?.getTime() || 0;
          diff = timeA - timeB;
        } else if (sortBy === 'price') {
          diff = (Number(a.total) || 0) - (Number(b.total) || 0);
        }
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [orders, activeTab, searchQuery, startDate, endDate, sortBy, sortOrder]);

  // Pagination
  const totalOrders = filteredOrders.length;
  const totalPages = Math.max(1, Math.ceil(totalOrders / pageSize));
  const currentSafePage = Math.min(currentPage, totalPages);
  const paginatedOrders = useMemo(() => {
    const start = (currentSafePage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentSafePage, pageSize]);

  const startDisplayIdx = totalOrders === 0 ? 0 : (currentSafePage - 1) * pageSize + 1;
  const endDisplayIdx = Math.min(currentSafePage * pageSize, totalOrders);

  // Auto-focus and open details when navigated from notification
  useEffect(() => {
    if (initialSelectedOrderId && orders.length > 0) {
      const target = orders.find((o) => o.order_id === initialSelectedOrderId);
      if (target) {
        setModalOrder(target);
        setActiveTab('all');
      }
      if (onClearSelectedOrder) {
        onClearSelectedOrder();
      }
    }
  }, [initialSelectedOrderId, orders, onClearSelectedOrder]);

  // Render single clean Status Badge
  const renderStatusBadge = (order) => {
    if (order.status === 'ready') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.18)] whitespace-nowrap shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
          Ready
        </span>
      );
    }
    if (order.status === 'preparing') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/35 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.18)] whitespace-nowrap shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />
          In Progress
        </span>
      );
    }
    if (order.status === 'transmitted') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/35 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.18)] whitespace-nowrap shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />
          In Progress
        </span>
      );
    }
    if (order.status === 'served') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/15 border border-blue-500/35 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.18)] whitespace-nowrap shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
          Completed
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/15 border border-red-500/35 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.18)] whitespace-nowrap shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />
        Cancelled
      </span>
    );
  };

  return (
    <div className="relative w-full min-h-screen">
      {/* Full-screen Ambient Background Video */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <video
          ref={bgVideoRef}
          src="/videos/PixVerse_full_animation_removed.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60 pointer-events-none" />
      </div>

      {/* Main Content Container */}
      <div className="relative z-10 w-full min-h-screen px-4 sm:px-8 lg:px-12 py-8 pb-28 max-w-[1700px] mx-auto select-none antialiased">
        
        {/* Top Header: "Orders" on left, Date on right */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Orders
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              {totalOrders} {totalOrders === 1 ? 'order' : 'orders'} found
            </p>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-zinc-300 hidden sm:inline-block">
              {formatToday()}
            </span>

            <button
              onClick={() => { setLoading(true); load(); }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-zinc-200 hover:text-amber-400 text-xs font-semibold backdrop-blur-xl transition-all active:scale-95 cursor-pointer shadow-lg"
              title="Refresh orders"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin text-amber-400' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </header>

        {/* Controls Bar: Glassmorphic Tabs & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-7">
          {/* Glassmorphic Status Tabs */}
          <div className="inline-flex items-center gap-2 bg-[#08090e]/80 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-lg" role="tablist">
            <button
              onClick={() => { setActiveTab('all'); setCurrentPage(1); }}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                  : 'bg-transparent text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              All {counts.all > 0 && <span className="opacity-75 text-xs ml-1">({counts.all})</span>}
            </button>

            <button
              onClick={() => { setActiveTab('process'); setCurrentPage(1); }}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'process'
                  ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                  : 'bg-transparent text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              On Process {counts.process > 0 && <span className="opacity-75 text-xs ml-1">({counts.process})</span>}
            </button>

            <button
              onClick={() => { setActiveTab('completed'); setCurrentPage(1); }}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'completed'
                  ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-extrabold shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                  : 'bg-transparent text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Completed {counts.completed > 0 && <span className="opacity-75 text-xs ml-1">({counts.completed})</span>}
            </button>

            {counts.cancelled > 0 && (
              <button
                onClick={() => { setActiveTab('cancelled'); setCurrentPage(1); }}
                className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'cancelled'
                    ? 'bg-red-500/20 border border-red-500/40 text-red-300 font-bold shadow-md'
                    : 'bg-transparent text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
              >
                Cancelled <span className="opacity-75 text-xs ml-1">({counts.cancelled})</span>
              </button>
            )}
          </div>

          {/* Action & Search Input */}
          <div className="flex items-center gap-3">
            {/* Filter Toggle Button */}
            <button
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              title="Filter & Date Options"
              className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all border shadow-lg cursor-pointer backdrop-blur-xl ${
                showFilterPanel || startDate || endDate
                  ? 'bg-amber-400 text-black border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                  : 'bg-[#08090e]/80 hover:bg-white/10 text-zinc-300 hover:text-amber-400 border-white/10'
              }`}
            >
              <SlidersHorizontal size={18} />
            </button>

            {/* Glassmorphic Search Input */}
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search a name, order, or etc"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full bg-[#08090e]/80 rounded-xl py-2.5 pl-4 pr-11 text-xs sm:text-sm text-white placeholder-zinc-500 border border-white/10 hover:border-white/20 focus:border-amber-400/60 focus:bg-[#0c0e14]/90 shadow-lg backdrop-blur-xl outline-none focus:ring-1 focus:ring-amber-400/30 transition-all"
              />
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-zinc-400">
                <Search size={16} />
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible Glass Filter Panel for Date Range & Sorting */}
        <AnimatePresence>
          {showFilterPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 p-4 rounded-2xl bg-[#08090e]/85 backdrop-blur-2xl border border-white/10 shadow-2xl text-zinc-200 overflow-hidden"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Date Range:</span>
                  <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5 border border-white/10 focus-within:border-amber-400/50">
                    <Calendar size={14} className="text-zinc-400" />
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                      className="bg-transparent text-xs text-white outline-none font-medium cursor-pointer scheme-dark"
                    />
                  </div>
                  <span className="text-xs text-zinc-500">to</span>
                  <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5 border border-white/10 focus-within:border-amber-400/50">
                    <Calendar size={14} className="text-zinc-400" />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                      className="bg-transparent text-xs text-white outline-none font-medium cursor-pointer scheme-dark"
                    />
                  </div>
                  {(startDate || endDate) && (
                    <button
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                      className="text-xs text-amber-400 hover:underline font-semibold cursor-pointer"
                    >
                      Clear dates
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Sort By:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-[#08090e] text-xs font-semibold text-zinc-200 rounded-xl px-3 py-1.5 border border-white/10 outline-none cursor-pointer focus:border-amber-400/50"
                  >
                    <option value="date">Date & Time</option>
                    <option value="price">Total Amount</option>
                    <option value="name">Customer Name</option>
                    <option value="id">Order Number</option>
                  </select>
                  <button
                    onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white cursor-pointer"
                    title={`Order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
                  >
                    {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border p-4 border-red-500/30 bg-red-500/10">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-400" />
            <p className="text-xs text-zinc-300">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-3 bg-[#08090e]/60 rounded-2xl backdrop-blur-md border border-white/10">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl">
              <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
            </div>
            <p className="text-xs text-zinc-300 uppercase tracking-wider font-semibold">Loading orders...</p>
          </div>
        ) : paginatedOrders.length === 0 ? (
          /* Empty State */
          <div className="rounded-2xl bg-[#08090e]/75 backdrop-blur-2xl p-16 text-center shadow-2xl my-4 border border-white/10">
            <Receipt className="w-12 h-12 mx-auto mb-4 text-zinc-500" />
            <h3 className="text-base font-bold text-white mb-1">No orders found</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              {searchQuery
                ? `No orders match your search "${searchQuery}". Try a different keyword.`
                : activeTab === 'all'
                ? 'Incoming orders from tables or the pickup window will display here.'
                : `No orders currently match status filter "${activeTab}".`}
            </p>
          </div>
        ) : (
          /* Glassmorphic Orders 3-Column Grid matching reference layout */
          <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedOrders.map((order) => {
              const tableBadge = getTableBadge(order);
              const isExpanded = !!expandedCardItems[order.order_id];
              const items = order.items || [];
              const displayItems = isExpanded ? items : items.slice(0, 3);
              const hasMore = items.length > 3;
              const moreCount = items.length - 3;
              const next = nextStatus(order.status);
              const isUpdating = updatingId === order.order_id;
              const isTerminal = order.status === 'served' || order.status === 'cancelled';

              return (
                <div
                  key={order.order_id}
                  id={`order-card-${order.order_id}`}
                  className="group relative rounded-[22px] p-5 flex flex-col justify-between transition-all duration-300 ease-out select-none overflow-hidden bg-[#08090e]/75 backdrop-blur-[24px] border border-white/[0.12] hover:border-amber-400/50 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.12)] hover:shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_0_25px_rgba(245,158,11,0.18),0_16px_40px_-10px_rgba(0,0,0,0.9)] hover:-translate-y-1"
                >
                  {/* Top rim specular highlight line */}
                  <div className="absolute top-0 left-6 right-6 h-[1px] pointer-events-none bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover:via-amber-400/50 transition-colors" />

                  <div>
                    {/* 1. Card Header: Table Badge, Customer Name/Subtitle & Status Badge */}
                    <div className="flex items-start justify-between gap-3 pb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-base tracking-tight shrink-0 backdrop-blur-md ${tableBadge.bgClass}`}>
                          {tableBadge.text}
                        </div>
                        <div className="min-w-0">
                          <h2 className="font-bold text-white text-base leading-tight truncate group-hover:text-amber-300 transition-colors" title={order.customer_name}>
                            {order.customer_name || 'Guest'}
                          </h2>
                          <p className="text-[11px] text-zinc-400/90 mt-0.5 font-normal truncate tracking-tight flex items-center gap-1">
                            <span>Order</span>
                            <span className="font-mono text-zinc-300">#{order.order_id}</span>
                            <span className="text-zinc-500">/</span>
                            <span>{tableBadge.label}</span>
                          </p>
                        </div>
                      </div>

                      {renderStatusBadge(order)}
                    </div>

                    {/* 2. Date and Time Row */}
                    <div className="flex items-center justify-between py-2.5 text-xs border-y border-white/[0.08] my-1">
                      <span className="text-zinc-400 font-medium">{formatDate(order.created_at)}</span>
                      <span className="text-zinc-200 font-bold tracking-tight">{formatTime(order.created_at) || '—'}</span>
                    </div>

                    {/* 3. Items Table matching mockup with locked column alignment */}
                    <div className="pt-3 pb-2">
                      <div className="grid grid-cols-[1fr_48px_64px] gap-2 items-center text-[11px] font-semibold uppercase tracking-wider text-zinc-500 pb-2 border-b border-white/[0.04]">
                        <span>Items</span>
                        <span className="text-center">Qty</span>
                        <span className="text-right">Price</span>
                      </div>

                      <div className="space-y-1 pt-1.5">
                        {displayItems.map((item, idx) => {
                          const isFaded = !isExpanded && hasMore && idx === 2;
                          const itemTotal = (Number(item.price || 0) * (item.quantity || 1)).toFixed(2);
                          return (
                            <div
                              key={idx}
                              className={`grid grid-cols-[1fr_48px_64px] gap-2 items-center text-xs py-1 transition-opacity ${
                                isFaded ? 'opacity-35' : 'text-zinc-200'
                              }`}
                            >
                              <span className="truncate font-medium text-zinc-200" title={item.name}>
                                {item.name}
                              </span>
                              <span className="text-center font-bold text-amber-400 tabular-nums">
                                {item.quantity || 1}
                              </span>
                              <span className="text-right font-semibold text-white tabular-nums">
                                ${itemTotal}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {hasMore && (
                        <div className="text-center pt-2">
                          <button
                            type="button"
                            onClick={(e) => toggleCardItems(order.order_id, e)}
                            className="text-[11px] font-semibold text-zinc-400 hover:text-amber-400 transition-colors py-1 px-2.5 rounded-lg hover:bg-white/5 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <span>{isExpanded ? 'Show less' : `+${moreCount} more`}</span>
                            <ChevronDown size={11} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180 text-amber-400' : ''}`} />
                          </button>
                        </div>
                      )}

                      {order.notes && (
                        <div className="mt-2.5 flex items-start gap-1.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-400/20 text-xs text-amber-300 font-normal">
                          <MessageSquare size={12} className="shrink-0 mt-0.5 text-amber-400" />
                          <span className="truncate"><strong>Note:</strong> {order.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Card Bottom: Total & Dual Action Buttons */}
                  <div className="pt-3 mt-2 border-t border-white/[0.08]">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold text-zinc-400">Total</span>
                      <span className="text-xl font-black text-white tabular-nums tracking-tight">
                        ${(Number(order.total) || 0).toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Left button: "See Details" with Frosted Glass look */}
                      <button
                        type="button"
                        onClick={() => setModalOrder(order)}
                        className="w-full py-2.5 px-3 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-zinc-200 hover:text-white font-semibold text-xs transition-all text-center cursor-pointer active:scale-[0.98]"
                      >
                        See Details
                      </button>

                      {/* Right button: Luminous Amber Button matching theme */}
                      {!isTerminal && next ? (
                        <button
                          type="button"
                          onClick={() => handleAdvance(order.order_id, next)}
                          disabled={isUpdating}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-extrabold text-xs hover:brightness-110 active:scale-[0.98] transition-all text-center shadow-[0_0_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_22px_rgba(245,158,11,0.4)] cursor-pointer disabled:opacity-40"
                        >
                          {order.status === 'ready'
                            ? 'Pay Bills'
                            : order.status === 'preparing'
                            ? 'Mark Ready'
                            : 'Start Cooking'}
                        </button>
                      ) : order.status === 'served' ? (
                        <button
                          type="button"
                          onClick={() => downloadOrderPDF(order, settings, 'admin')}
                          className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-extrabold text-xs hover:brightness-110 active:scale-[0.98] transition-all text-center shadow-[0_0_15px_rgba(245,158,11,0.25)] cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <FileDown size={13} />
                          <span>PDF Receipt</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="w-full py-2.5 px-3 rounded-xl bg-white/5 border border-white/5 text-zinc-500 font-bold text-xs text-center cursor-not-allowed"
                        >
                          Cancelled
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </main>
        )}

        {/* Footer Pagination */}
        {!loading && totalOrders > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-4 border-t border-white/10 text-xs sm:text-sm text-zinc-300">
            <p>
              Showing <span className="font-semibold text-white">{startDisplayIdx}</span>–
              <span className="font-semibold text-white">{endDisplayIdx}</span> of{' '}
              <span className="font-semibold text-white">{totalOrders}</span> orders
            </p>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentSafePage <= 1}
                className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 text-white transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Previous Page"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const p = i + 1;
                const isCurrent = p === currentSafePage;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center justify-center ${
                      isCurrent
                        ? 'bg-amber-400 text-black font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                        : 'bg-white/5 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/15'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentSafePage >= totalPages}
                className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 text-white transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal ("See Details" Click) with Dark Glassmorphism */}
      <AnimatePresence>
        {modalOrder && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#0c0e14]/95 backdrop-blur-3xl border border-white/15 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_40px_rgba(245,158,11,0.1)] flex flex-col text-white"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center text-sm ${getTableBadge(modalOrder).bgClass}`}>
                    {getTableBadge(modalOrder).text}
                  </span>
                  <div>
                    <h3 className="font-bold text-base text-white leading-snug">
                      {modalOrder.customer_name || 'Guest'}
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5 font-normal tracking-tight flex items-center gap-1">
                      <span>Order</span>
                      <span className="font-mono text-zinc-300">#{modalOrder.order_id}</span>
                      <span className="text-zinc-500">•</span>
                      <span className={getTableBadge(modalOrder).isTakeaway ? "text-cyan-400 font-medium" : "text-zinc-300 font-medium"}>
                        {getTableBadge(modalOrder).label}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setModalOrder(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4">
                <div className="flex justify-between items-center text-xs text-zinc-400 pb-2 border-b border-white/10">
                  <span>{formatDate(modalOrder.created_at)} • {formatTime(modalOrder.created_at)}</span>
                  {renderStatusBadge(modalOrder)}
                </div>

                {/* Items List */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-3">
                    <Utensils size={13} /> Ordered Dishes ({(modalOrder.items || []).length})
                  </h4>
                  <div className="space-y-2 text-sm">
                    {(modalOrder.items || []).map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-white/[0.06] last:border-0">
                        <div>
                          <p className="font-semibold text-zinc-100 text-xs">{item.name}</p>
                          <p className="text-[11px] text-zinc-400">
                            Qty: <span className="text-amber-400 font-bold">{item.quantity || 1}</span> × ${Number(item.price || 0).toFixed(2)}
                          </p>
                        </div>
                        <span className="font-bold text-white text-xs tabular-nums">
                          ${((Number(item.price) || 0) * (item.quantity || 1)).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {modalOrder.notes && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/20 text-xs text-amber-300">
                    <p className="font-bold mb-0.5 flex items-center gap-1 text-amber-400">
                      <MessageSquare size={13} /> Kitchen Note:
                    </p>
                    <p>{modalOrder.notes}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="font-bold text-zinc-300 text-base">Total Amount</span>
                  <span className="font-black text-2xl text-amber-400 tabular-nums">
                    ${(Number(modalOrder.total) || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="p-4 bg-[#08090e]/80 border-t border-white/10 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => downloadOrderPDF(modalOrder, settings, 'admin')}
                  className="py-2.5 px-3.5 bg-white/5 border border-white/10 text-zinc-200 hover:text-white font-semibold rounded-xl text-xs hover:bg-white/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Download PDF"
                >
                  <FileDown size={14} />
                  <span>PDF Invoice</span>
                </button>

                {modalOrder.status === 'transmitted' && (
                  <button
                    type="button"
                    onClick={() => {
                      handleCancel(modalOrder.order_id);
                      setModalOrder(null);
                    }}
                    className="py-2.5 px-3 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-300 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Cancel Order
                  </button>
                )}

                <div className="flex-1" />

                {(() => {
                  const next = nextStatus(modalOrder.status);
                  if (next) {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          handleAdvance(modalOrder.order_id, next);
                          setModalOrder(null);
                        }}
                        className="py-2.5 px-5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black font-extrabold rounded-xl text-xs hover:brightness-110 transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] cursor-pointer"
                      >
                        {modalOrder.status === 'ready'
                          ? 'Pay Bills (Complete)'
                          : modalOrder.status === 'preparing'
                          ? 'Mark Ready'
                          : 'Mark Preparing'}
                      </button>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => setModalOrder(null)}
                      className="py-2.5 px-5 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      Close
                    </button>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default OrdersPage;