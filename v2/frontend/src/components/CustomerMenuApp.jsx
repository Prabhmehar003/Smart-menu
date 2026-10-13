// CustomerMenuApp.jsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Plus, Minus, Search, X, MessageSquare,
  RefreshCw, WifiOff, ImageOff, Flame, Star, Store, CreditCard,
  ChefHat, CheckCircle2, ArrowRight, UtensilsCrossed, Clock,
} from 'lucide-react';
import { OrderTracking } from '../OrderTracking';
import { api } from '../api';
import { broadcastLocalOrder } from '../realtime';

const MENU_THEMES = {
  'acid-lime': { accent: '#D6FF00', secondary: '#8FCF00', gradient: 'from-[#D6FF00]/30 via-[#8FCF00]/10 to-transparent' },
  'acid-cyan': { accent: '#00F0FF', secondary: '#00A0CF', gradient: 'from-[#00F0FF]/30 via-[#00A0CF]/10 to-transparent' },
  'acid-pink': { accent: '#FF00FF', secondary: '#CF00A0', gradient: 'from-[#FF00FF]/30 via-[#CF00A0]/10 to-transparent' },
  'bright-orange-neon': { accent: '#FF6B00', secondary: '#FFB000', gradient: 'from-[#FF6B00]/35 via-[#FFB000]/10 to-transparent' },
};

const ORDER_STATUS_META = {
  transmitted: { label: 'Order Received', color: '#00C2D6', border: 'border-[#00C2D6]/40', bg: 'bg-[#00C2D6]/15' },
  preparing:   { label: 'Being Prepared', color: '#FFB800', border: 'border-[#FFB800]/40', bg: 'bg-[#FFB800]/15' },
  ready:       { label: 'Ready to Serve', color: '#D6FF00', border: 'border-[#D6FF00]/40', bg: 'bg-[#D6FF00]/15' },
  served:      { label: 'Served',          color: '#A855F7', border: 'border-[#A855F7]/40', bg: 'bg-[#A855F7]/15' },
  cancelled:   { label: 'Cancelled',       color: '#FF3B3B', border: 'border-[#FF3B3B]/40', bg: 'bg-[#FF3B3B]/15' },
};

function DishImage({ item, theme, accent }) {
  const [errored, setErrored] = useState(false);
  const showFallback = !item.image_url || errored;
  const grad = MENU_THEMES[theme]?.gradient || MENU_THEMES['acid-lime'].gradient;
  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
      {showFallback ? (
        <div className={`w-full h-full bg-gradient-to-br ${grad} bg-[#0a0a0a] flex items-center justify-center`}>
          <ImageOff className="w-6 h-6 text-white/15" />
        </div>
      ) : (
        <img src={item.image_url} alt={item.name} onError={() => setErrored(true)} loading="lazy" className="w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />
      {item.tags?.includes('popular') && (
        <span style={{ backgroundColor: accent }} className="absolute top-2 left-2 text-black text-[9px] font-mono font-black px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
          <Star size={9} fill="black" /> POPULAR
        </span>
      )}
      {item.tags?.includes('spicy') && (
        <span className="absolute top-2 right-2 bg-[#FF3B3B]/90 text-white text-[9px] font-mono font-black px-2 py-1 rounded-full flex items-center gap-1 shadow-md">
          <Flame size={9} fill="white" /> SPICY
        </span>
      )}
    </div>
  );
}

function CustomerMenuApp({ session, settings = {} }) {
  const { session_token, table_id, menu_data } = session;
  const isCounterOrder = table_id === 'COUNTER';
  const [liveSettings, setLiveSettings] = useState(settings);

  useEffect(() => {
    setLiveSettings(settings);
  }, [settings]);

  useEffect(() => {
    const handleSettingsUpdated = (e) => {
      if (e?.detail) setLiveSettings(e.detail);
    };
    window.addEventListener('smart_menu_settings_updated', handleSettingsUpdated);
    return () => window.removeEventListener('smart_menu_settings_updated', handleSettingsUpdated);
  }, []);

  const effectiveSettings = { ...liveSettings, ...settings };
  const menuTheme = MENU_THEMES[effectiveSettings.default_theme] || MENU_THEMES['acid-lime'];

  useEffect(() => {
    if (!effectiveSettings?.plan) {
      fetch('/api/settings')
        .then((r) => (r.ok ? r.json() : {}))
        .then((data) => {
          if (data?.plan) setLiveSettings((prev) => ({ ...prev, ...data }));
        })
        .catch(() => {});
    }
  }, [effectiveSettings?.plan]);

  useEffect(() => {
    if (effectiveSettings?.plan && session && session.plan !== effectiveSettings.plan) {
      session.plan = effectiveSettings.plan;
      try {
        localStorage.setItem('acid_session', JSON.stringify({ ...session, plan: effectiveSettings.plan }));
      } catch {}
    }
  }, [effectiveSettings?.plan, session]);

  // Plan filtering:
  // 'basic': View-only menu cards (no add-to-cart option, no food ordering flow)
  // 'pro'  : Full interactive ordering (add dishes to order, table cart, checkout)
  const currentPlan = useMemo(() => {
    if (effectiveSettings?.plan) return effectiveSettings.plan.toLowerCase();
    try {
      const cached = localStorage.getItem('smart_menu_settings_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.plan) return parsed.plan.toLowerCase();
      }
    } catch {}
    if (session?.plan) return session.plan.toLowerCase();
    return 'basic';
  }, [effectiveSettings?.plan, session?.plan]);

  const isBasicPlan = currentPlan === 'basic';
  const isProPlan = !isBasicPlan;

  const [cart, setCart]                       = useState({});
  const [isCartOpen, setIsCartOpen]           = useState(false);
  const [isOrderedModalOpen, setIsOrderedModalOpen] = useState(false);
  const [customerInfo, setCustomerInfo]       = useState({ name: '', email: '' });
  const [orderNotes, setOrderNotes]           = useState('');
  const [paymentMethod, setPaymentMethod]     = useState('card');
  const [checkoutStatus, setCheckoutStatus]   = useState('idle');
  const [checkoutError, setCheckoutError]     = useState(null);
  const [searchQuery, setSearchQuery]         = useState('');
  const [activeCategory, setActiveCategory]   = useState(menu_data.categories[0]?.category_name || '');

  // Tracking state & placed orders persistence (scoped strictly to current scanning session)
  const [trackingOrderId, setTrackingOrderId] = useState(null);
  const [placedOrders, setPlacedOrders]       = useState(() => {
    try {
      const key = session_token ? `smart_menu_orders_${session_token}` : `smart_menu_orders_${table_id}`;
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fetchSessionOrders = useCallback(async () => {
    if (!session_token) return;
    try {
      const res = await api.getSessionOrders(session_token);
      if (res && Array.isArray(res.orders)) {
        setPlacedOrders(res.orders);
        try {
          localStorage.setItem(`smart_menu_orders_${session_token}`, JSON.stringify(res.orders));
        } catch {}
      }
    } catch (err) {
      // fallback to cached orders
    }
  }, [session_token]);

  useEffect(() => {
    if (!session_token) return;
    try {
      const saved = localStorage.getItem(`smart_menu_orders_${session_token}`);
      setPlacedOrders(saved ? JSON.parse(saved) : []);
    } catch {
      setPlacedOrders([]);
    }
  }, [session_token]);

  useEffect(() => {
    fetchSessionOrders();
    const interval = setInterval(fetchSessionOrders, 10000);
    return () => clearInterval(interval);
  }, [fetchSessionOrders]);

  // Aggregate items ordered from this menu
  const orderedItemsMap = useMemo(() => {
    const map = {};
    placedOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!map[item.name]) {
          map[item.name] = {
            quantity: 0,
            latestStatus: order.status,
            latestOrderId: order.order_id,
            orders: [],
          };
        }
        map[item.name].quantity += (item.quantity || 1);
        map[item.name].orders.push({
          order_id: order.order_id,
          quantity: item.quantity || 1,
          status: order.status,
        });
      });
    });
    return map;
  }, [placedOrders]);

  const totalOrderedItemsCount = useMemo(() => {
    return Object.values(orderedItemsMap).reduce((acc, cur) => acc + cur.quantity, 0);
  }, [orderedItemsMap]);

  const latestActiveOrder = useMemo(() => {
    if (!placedOrders || placedOrders.length === 0) return null;
    const active = placedOrders.find((o) => o.status !== 'served' && o.status !== 'cancelled');
    return active || placedOrders[0];
  }, [placedOrders]);

  const sectionRefs = useRef({});

  const updateQuantity = (item, delta) => {
    if (isBasicPlan) return;
    setCart((prev) => {
      const qty = (prev[item.name]?.quantity || 0) + delta;
      if (qty <= 0) {
        const copy = { ...prev };
        delete copy[item.name];
        return copy;
      }
      return { ...prev, [item.name]: { ...item, quantity: qty } };
    });
  };

  const cartItemsArray = Object.values(cart);
  const totalCount = cartItemsArray.reduce((a, c) => a + c.quantity, 0);
  const totalPrice = cartItemsArray.reduce((a, c) => a + c.price * c.quantity, 0);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return menu_data.categories;
    const q = searchQuery.trim().toLowerCase();
    return menu_data.categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.name.toLowerCase().includes(q) ||
            (item.description || '').toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [searchQuery, menu_data.categories]);

  const scrollToCategory = (catName) => {
    setActiveCategory(catName);
    const el = sectionRefs.current[catName];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleCheckout = async () => {
    if (isBasicPlan) {
      return alert('Direct food ordering is disabled on the Basic Plan. Please ask your server to take your order.');
    }
    if (!customerInfo.name.trim()) {
      return alert('Please enter your name to continue.');
    }
    if (!customerInfo.email.trim() || !EMAIL_REGEX.test(customerInfo.email.trim())) {
      return alert('Please enter a valid email address (e.g., alex@example.com).');
    }
    setCheckoutStatus('submitting');
    setCheckoutError(null);

    const formattedNotes = isCounterOrder
      ? `[PRE-PAID ONLINE via ${paymentMethod.toUpperCase()}] ${orderNotes || ''}`
      : (orderNotes || undefined);

    let res;
    try {
      res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token,
          customer_name:  customerInfo.name,
          customer_email: customerInfo.email,
          notes: formattedNotes,
          items: cartItemsArray.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
        }),
      });
    } catch {
      setCheckoutStatus('error');
      setCheckoutError({ kind: 'network', message: 'Could not reach the server.' });
      return;
    }

    let data = {};
    try { data = await res.json(); } catch {}

    if (!res.ok) {
      setCheckoutStatus('error');
      if (res.status === 401) {
        setCheckoutError({
          kind: 'session',
          message: 'Your 3-hour session expired. Please rescan the QR code.',
        });
      } else {
        setCheckoutError({
          kind: 'other',
          message: data.detail || 'Failed to place order. Please try again.',
        });
      }
      return;
    }

    const placedOrderRecord = {
      order_id: data.order_id,
      table_id: table_id,
      status: 'transmitted',
      total: totalPrice,
      created_at: new Date().toISOString(),
      items: cartItemsArray.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
    };
    setPlacedOrders((prev) => {
      const updated = [placedOrderRecord, ...prev.filter((o) => o.order_id !== data.order_id)];
      try {
        const key = session_token ? `smart_menu_orders_${session_token}` : `smart_menu_orders_${table_id}`;
        localStorage.setItem(key, JSON.stringify(updated));
      } catch {}
      return updated;
    });

    broadcastLocalOrder(placedOrderRecord);

    setTrackingOrderId(data.order_id);
    setCart({});
    setOrderNotes('');
    setIsCartOpen(false);
    setCheckoutStatus('idle');
    fetchSessionOrders();
  };

  const handleSessionExpiredRestart = () => {
    window.location.href = '/';
  };

  if (trackingOrderId) {
    return (
      <OrderTracking
        orderId={trackingOrderId}
        sessionToken={session_token}
        tableId={table_id}
        onClose={() => {
          setTrackingOrderId(null);
          fetchSessionOrders();
        }}
        settings={settings}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-40 selection:text-black relative overflow-x-hidden">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full blur-[120px]" style={{ backgroundColor: menuTheme.accent, opacity: 0.12 }} />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] rounded-full blur-[120px]" style={{ backgroundColor: menuTheme.secondary, opacity: 0.12 }} />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-2xl bg-[#050505]/70 border-b border-white/10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span style={{ color: menuTheme.secondary, borderColor: `${menuTheme.secondary}4D` }} className="font-mono text-[10px] bg-white/5 px-2.5 py-1 rounded-full border inline-flex items-center gap-1">
                {isCounterOrder ? <><Store size={10} /> SERVICE WINDOW</> : <>TABLE {table_id}</>}
              </span>
              {isBasicPlan && (
                <span className="font-mono text-[10px] bg-amber-400/10 text-amber-400 px-2.5 py-1 rounded-full border border-amber-400/30 inline-flex items-center gap-1 font-semibold">
                  <UtensilsCrossed size={10} /> DIGITAL MENU
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight mt-1.5 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              {settings.restaurant_name || menu_data.restaurant_name}
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            {!isBasicPlan && placedOrders.length > 0 && (
              <button
                onClick={() => setIsOrderedModalOpen(true)}
                style={{
                  borderColor: `${menuTheme.accent}80`,
                  boxShadow: `0 0 16px ${menuTheme.accent}33`,
                }}
                className="group relative flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#08090e]/95 border hover:border-white/60 text-white transition-all cursor-pointer"
                title="View ordered food"
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: menuTheme.accent }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2 w-2"
                    style={{ backgroundColor: menuTheme.accent }}
                  />
                </span>
                <span
                  className="font-mono text-[11px] font-black uppercase tracking-wider"
                  style={{ color: menuTheme.accent }}
                >
                  Ordered Food
                </span>
                {totalOrderedItemsCount > 0 && (
                  <span
                    className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                    style={{
                      backgroundColor: `${menuTheme.accent}26`,
                      color: menuTheme.accent,
                    }}
                  >
                    {totalOrderedItemsCount}
                  </span>
                )}
              </button>
            )}
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: menuTheme.accent, boxShadow: `0 0 12px ${menuTheme.accent}` }} />
          </div>
        </div>

        {/* Search */}
        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-10 py-3 font-mono text-xs text-white placeholder:text-white/25 focus:border-[#D6FF00]/50 outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Category nav */}
        {!searchQuery.trim() && (
          <nav className="flex gap-2 px-6 pb-4 overflow-x-auto no-scrollbar">
            {menu_data.categories.map((cat) => (
              <button
                key={cat.category_name}
                onClick={() => scrollToCategory(cat.category_name)}
                className={`font-mono text-xs px-4 py-2 rounded-xl border whitespace-nowrap transition-all ${
                  activeCategory === cat.category_name
                    ? 'text-black font-bold'
                    : 'bg-white/5 text-white/60 border-white/10 hover:border-white/25'
                }`}
                style={activeCategory === cat.category_name ? { backgroundColor: menuTheme.accent, borderColor: menuTheme.accent } : undefined}
              >
                {cat.category_name}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Menu grid */}
      <main className="max-w-6xl mx-auto px-4 py-10 space-y-16 relative z-10">
        {searchQuery.trim() && filteredCategories.length === 0 && (
          <div className="text-center py-16">
            <p className="font-mono text-white/40 text-sm">No dishes match "{searchQuery}".</p>
          </div>
        )}

        {(searchQuery.trim() ? filteredCategories : menu_data.categories).map((cat) => {
          const categoryTheme = MENU_THEMES[cat.theme] || menuTheme;
          return (
            <section
              key={cat.category_name}
              data-category={cat.category_name}
              ref={(el) => (sectionRefs.current[cat.category_name] = el)}
              className="space-y-6 scroll-mt-44"
            >
              <div className="border-b pb-4 flex items-center justify-between" style={{ borderColor: `${categoryTheme.accent}4D` }}>
                <h2 className="text-3xl font-black uppercase tracking-tight" style={{ color: categoryTheme.accent }}>{cat.category_name}</h2>
                <span className="font-mono text-[10px] text-white/25">{cat.items.length} items</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {cat.items.map((item, i) => {
                  const qty = cart[item.name]?.quantity || 0;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 16 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.4, delay: (i % 6) * 0.04 }}
                      className="group relative bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden hover:border-white/25 hover:bg-white/[0.07] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
                    >
                      <div className="p-3 pb-0">
                        <DishImage item={item} theme={cat.theme || settings.default_theme} accent={categoryTheme.accent} />
                      </div>
                      <div className="p-5 pt-4">
                        <div className="flex justify-between items-start gap-3 mb-1.5">
                          <h3 className="font-bold text-base leading-snug">{item.name}</h3>
                          <span className="font-mono font-black shrink-0 text-lg" style={{ color: menuTheme.accent }}>
                            ${parseFloat(item.price).toFixed(2)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-white/45 text-xs font-mono mb-4 leading-relaxed line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        {!isBasicPlan ? (
                          <div className="flex items-center justify-between pt-3 border-t border-white/5">
                            {qty === 0 ? (
                              <button
                                onClick={() => updateQuantity(item, 1)}
                                style={{ backgroundColor: menuTheme.accent }}
                                className="w-full text-black font-mono font-black text-xs px-4 py-2.5 rounded-xl hover:bg-white transition-colors cursor-pointer"
                              >
                                + ADD TO ORDER
                              </button>
                            ) : (
                              <div className="w-full flex items-center justify-between gap-3 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                                <button onClick={() => updateQuantity(item, -1)} className="text-white hover:text-[#FF00FF] p-1">
                                  <Minus size={16} />
                                </button>
                                <span className="font-mono font-bold text-sm">{qty} in order</span>
                                <button onClick={() => updateQuantity(item, 1)} style={{ color: menuTheme.accent }} className="text-white p-1">
                                  <Plus size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[11px] font-mono text-zinc-400">
                            <span className="inline-flex items-center gap-1.5 text-zinc-400">
                              <UtensilsCrossed size={12} className="text-zinc-500" />
                              Digital Menu Card
                            </span>
                            <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10">
                              View Only
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </main>

      {/* ========================================================================= */}
      {/* POPUP MODAL: ORDERED FOOD                                                 */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isOrderedModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-[#0c0e14] border border-white/15 rounded-3xl p-6 shadow-2xl overflow-hidden font-sans text-white max-h-[90vh] flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl border flex items-center justify-center"
                    style={{
                      backgroundColor: `${menuTheme.accent}1A`,
                      borderColor: `${menuTheme.accent}4D`,
                    }}
                  >
                    <UtensilsCrossed size={16} style={{ color: menuTheme.accent }} />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-lg text-white uppercase tracking-tight">Ordered Food</h3>
                    <p className="font-mono text-[10px] text-zinc-400">
                      {isCounterOrder ? 'Service Window Pickup' : `Table ${table_id}`} • {placedOrders.length} order{placedOrders.length > 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOrderedModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Orders List Content */}
              <div className="overflow-y-auto py-4 space-y-4 flex-1 pr-1">
                {placedOrders.length === 0 ? (
                  <div className="text-center py-10 text-zinc-500 font-mono text-xs">
                    No orders placed yet from this menu.
                  </div>
                ) : (
                  placedOrders.map((ord) => {
                    const statusMeta = ORDER_STATUS_META[ord.status] || ORDER_STATUS_META.transmitted;
                    return (
                      <div
                        key={ord.order_id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-white">Order #{ord.order_id}</span>
                            <span
                              className="font-mono text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border"
                              style={{
                                color: statusMeta.color,
                                borderColor: `${statusMeta.color}40`,
                                backgroundColor: `${statusMeta.color}15`,
                              }}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                          {ord.created_at && (
                            <span className="font-mono text-[9.5px] text-zinc-500 flex items-center gap-1">
                              <Clock size={10} />
                              {new Date(ord.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {/* Items list */}
                        <div className="space-y-2">
                          {(ord.items || []).map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between font-mono text-xs">
                              <span className="text-zinc-200">
                                <span className="font-bold mr-1.5" style={{ color: menuTheme.accent }}>{it.quantity}x</span>
                                {it.name}
                              </span>
                              <span className="text-zinc-400">${(it.price * it.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>

                        {/* Order Total & Detail Link */}
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <div>
                            <span className="font-mono text-[10px] text-zinc-400">Total: </span>
                            <span className="font-mono text-xs font-black" style={{ color: menuTheme.accent }}>${parseFloat(ord.total || 0).toFixed(2)}</span>
                          </div>
                          <button
                            onClick={() => {
                              setIsOrderedModalOpen(false);
                              setTrackingOrderId(ord.order_id);
                            }}
                            style={{ color: menuTheme.accent }}
                            className="font-mono text-[11px] font-bold hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <span>Live Kitchen Tracker</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              {placedOrders.length > 0 && (
                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                  <button
                    onClick={() => {
                      setIsOrderedModalOpen(false);
                      setTrackingOrderId(latestActiveOrder?.order_id || placedOrders[0]?.order_id);
                    }}
                    style={{ backgroundColor: menuTheme.accent }}
                    className="flex-1 py-2.5 rounded-xl font-mono text-xs font-black text-black hover:bg-white transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg"
                  >
                    <span>OPEN FULL LIVE TRACKER</span>
                    <ArrowRight size={14} />
                  </button>
                  <button
                    onClick={() => setIsOrderedModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 font-mono text-xs font-bold transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Cart Button: Only visible in Pro Plan */}
      <AnimatePresence>
        {!isBasicPlan && totalCount > 0 && !isCartOpen && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-xl z-40">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="bg-[#0a0a0a]/90 backdrop-blur-2xl border-2 p-4 rounded-3xl flex items-center justify-between"
              style={{ borderColor: menuTheme.accent, boxShadow: `0 10px 50px ${menuTheme.accent}26` }}
            >
              <div className="flex items-center gap-3">
                <div style={{ backgroundColor: menuTheme.accent }} className="text-black font-mono font-black w-10 h-10 rounded-2xl flex items-center justify-center">
                  {totalCount}
                </div>
                <div>
                  <p className="font-mono text-xs text-white/50">CART TOTAL</p>
                  <p className="font-mono font-bold text-lg">${totalPrice.toFixed(2)}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(true)}
                style={{ backgroundColor: menuTheme.accent }}
                className="text-black font-mono font-black px-6 py-3 rounded-2xl hover:bg-white flex items-center gap-2 transition-colors"
              >
                <ShoppingBag size={16} /> REVIEW ORDER
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cart Drawer: Only accessible in Pro Plan */}
      <AnimatePresence>
        {!isBasicPlan && isCartOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="w-full max-w-md bg-[#0a0a0a]/95 backdrop-blur-2xl border-l border-white/10 p-6 flex flex-col h-full overflow-y-auto"
            >
              {/* Drawer Header */}
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 sticky top-0 bg-[#0a0a0a]/95 -mt-6 -mx-6 px-6 pt-6 z-10">
                <h2 className="text-xl font-black uppercase">Your Order</h2>
                <button onClick={() => setIsCartOpen(false)} className="font-mono text-xs text-white/50 hover:text-white flex items-center gap-1">
                  <X size={14} /> CLOSE
                </button>
              </div>

              {/* Items Summary */}
              <div className="space-y-3 mb-6">
                <h3 className="font-mono text-[10px] text-white/40 tracking-widest uppercase">Order summary</h3>
                {cartItemsArray.length === 0 ? (
                  <p className="font-mono text-xs text-white/30 py-6 text-center">Your cart is empty.</p>
                ) : (
                  cartItemsArray.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-white/[0.04] p-3 rounded-2xl border border-white/5">
                      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-white/5">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageOff className="w-4 h-4 text-white/15" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm truncate">{item.name}</h4>
                        <span className="font-mono text-xs" style={{ color: menuTheme.secondary }}>${item.price.toFixed(2)} each</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                        <button onClick={() => updateQuantity(item, -1)} className="text-white/60 hover:text-[#FF00FF] p-1">
                          <Minus size={12} />
                        </button>
                        <span className="font-mono font-bold text-xs w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item, 1)} style={{ color: menuTheme.accent }} className="text-white/60 p-1">
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="font-mono font-bold text-sm w-16 text-right shrink-0">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Service Window Pre-Payment Banner */}
              {cartItemsArray.length > 0 && isCounterOrder && (
                <div className="mb-6 bg-[#00F0FF]/10 border border-[#00F0FF]/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-[#00F0FF] font-mono text-xs font-bold uppercase">
                    <CreditCard size={14} /> Service Window — Pre-Payment Required
                  </div>
                  <p className="font-mono text-[11px] text-white/70 leading-relaxed">
                    Counter orders require instant payment before transmission to the kitchen. You will receive an Order # for window pickup.
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={`p-2.5 rounded-xl border font-mono text-[10px] font-bold text-center transition-all ${
                        paymentMethod === 'card'
                          ? 'border-[#00F0FF] bg-[#00F0FF]/25 text-[#00F0FF] shadow-sm'
                          : 'border-white/10 bg-white/5 text-white/50'
                      }`}
                    >
                      💳 Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('upi')}
                      className={`p-2.5 rounded-xl border font-mono text-[10px] font-bold text-center transition-all ${
                        paymentMethod === 'upi'
                          ? 'border-[#00F0FF] bg-[#00F0FF]/25 text-[#00F0FF] shadow-sm'
                          : 'border-white/10 bg-white/5 text-white/50'
                      }`}
                    >
                      📱 UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('applepay')}
                      className={`p-2.5 rounded-xl border font-mono text-[10px] font-bold text-center transition-all ${
                        paymentMethod === 'applepay'
                          ? 'border-[#00F0FF] bg-[#00F0FF]/25 text-[#00F0FF] shadow-sm'
                          : 'border-white/10 bg-white/5 text-white/50'
                      }`}
                    >
                       ApplePay
                    </button>
                  </div>
                </div>
              )}

              {/* Notes */}
              {cartItemsArray.length > 0 && (
                <div className="mb-6">
                  <label className="font-mono text-[10px] text-white/40 tracking-widest uppercase flex items-center gap-2 mb-2">
                    <MessageSquare size={12} /> Notes (optional)
                  </label>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Allergies, spice level, special requests..."
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 p-3 rounded-xl font-mono text-white text-xs placeholder:text-white/25 focus:border-[#D6FF00]/50 outline-none resize-none"
                  />
                </div>
              )}

              {/* Customer details (Full Name & Email) */}
              {cartItemsArray.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="font-mono text-[10px] text-white/40 tracking-widest uppercase">Your details</h3>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl font-mono text-white text-sm placeholder:text-white/25 focus:border-[#D6FF00]/50 outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl font-mono text-white text-sm placeholder:text-white/25 focus:border-[#D6FF00]/50 outline-none"
                  />
                </div>
              )}

              {/* Checkout Error */}
              <AnimatePresence>
                {checkoutStatus === 'error' && checkoutError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 bg-[#FF00FF]/5 border border-[#FF00FF]/30 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      {checkoutError.kind === 'network' ? (
                        <WifiOff size={16} className="text-[#FF00FF] shrink-0 mt-0.5" />
                      ) : (
                        <RefreshCw size={16} className="text-[#FF00FF] shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <p className="font-mono text-xs text-[#FF00FF] font-bold mb-1">
                          {checkoutError.kind === 'session' ? 'SESSION EXPIRED' : 'ORDER FAILED'}
                        </p>
                        <p className="font-mono text-[11px] text-white/50 leading-relaxed">{checkoutError.message}</p>
                        {checkoutError.kind === 'session' ? (
                          <button onClick={handleSessionExpiredRestart} className="mt-2 font-mono text-[11px] text-[#00F0FF] hover:underline">
                            Rescan QR code →
                          </button>
                        ) : (
                          <button onClick={handleCheckout} className="mt-2 font-mono text-[11px] text-[#00F0FF] hover:underline">
                            Retry order →
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sticky Drawer Footer */}
              <div className="mt-auto pt-6 border-t border-white/10 space-y-4 sticky bottom-0 bg-[#0a0a0a]/95 -mx-6 px-6 pb-2">
                <div className="flex justify-between font-mono text-lg font-bold">
                  <span>TOTAL:</span>
                  <span style={{ color: menuTheme.accent }}>${totalPrice.toFixed(2)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={cartItemsArray.length === 0 || checkoutStatus === 'submitting'}
                  className={`w-full font-mono font-black py-4 rounded-2xl transition-colors tracking-widest text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                    isCounterOrder
                      ? 'bg-[#00F0FF] text-black hover:bg-white'
                      : 'text-black hover:bg-white'
                  }`}
                  style={!isCounterOrder ? { backgroundColor: menuTheme.accent } : undefined}
                >
                  {checkoutStatus === 'submitting' ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> {isCounterOrder ? 'PROCESSING PAYMENT...' : 'PLACING ORDER...'}
                    </>
                  ) : isCounterOrder ? (
                    'PAY & PLACE ORDER'
                  ) : (
                    'PLACE ORDER'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CustomerMenuApp;
