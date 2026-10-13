import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingBag, Plus, Minus, CheckCircle, Search, X, MessageSquare,
  RefreshCw, WifiOff, ImageOff, Flame, Star,
} from 'lucide-react';

const THEME_FALLBACK = {
  'acid-lime': 'from-[#D6FF00]/30 via-[#8FCF00]/10 to-transparent',
  'acid-cyan': 'from-[#00F0FF]/30 via-[#00A0CF]/10 to-transparent',
  'acid-pink': 'from-[#FF00FF]/30 via-[#CF00A0]/10 to-transparent',
};

function DishImage({ item, theme }) {
  const [errored, setErrored] = useState(false);
  const showFallback = !item.image_url || errored;
  const fallbackGradient = THEME_FALLBACK[theme] || THEME_FALLBACK['acid-lime'];

  return (
    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden">
      {showFallback ? (
        <div className={`w-full h-full bg-gradient-to-br ${fallbackGradient} bg-[#0a0a0a] flex items-center justify-center`}>
          <ImageOff className="w-6 h-6 text-white/15" />
        </div>
      ) : (
        <img
          src={item.image_url}
          alt={item.name}
          onError={() => setErrored(true)}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent" />
      {item.tags?.includes('popular') && (
        <span className="absolute top-2 left-2 bg-[#D6FF00] text-black text-[9px] font-mono font-black px-2 py-1 rounded-full flex items-center gap-1">
          <Star size={9} fill="black" /> POPULAR
        </span>
      )}
      {item.tags?.includes('spicy') && (
        <span className="absolute top-2 right-2 bg-[#FF3B3B]/90 text-white text-[9px] font-mono font-black px-2 py-1 rounded-full flex items-center gap-1">
          <Flame size={9} fill="white" /> SPICY
        </span>
      )}
    </div>
  );
}

function CustomerMenuApp({ session }) {
  const { session_token, table_id, menu_data } = session;

  const currentPlan = useMemo(() => {
    if (session?.plan) return session.plan.toLowerCase();
    try {
      const cached = localStorage.getItem('smart_menu_settings_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.plan) return parsed.plan.toLowerCase();
      }
    } catch {}
    return 'basic';
  }, [session?.plan]);

  const isBasicPlan = currentPlan === 'basic';

  const [cart, setCart] = useState({});
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: '', email: '' });
  const [orderNotes, setOrderNotes] = useState('');
  const [orderState, setOrderState] = useState(null);
  const [checkoutStatus, setCheckoutStatus] = useState('idle');
  const [checkoutError, setCheckoutError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(menu_data.categories[0]?.category_name || '');

  const sectionRefs = useRef({});

  const updateQuantity = (item, delta) => {
    setCart((prev) => {
      const current = prev[item.name]?.quantity || 0;
      const nextQty = current + delta;
      if (nextQty <= 0) {
        const copy = { ...prev };
        delete copy[item.name];
        return copy;
      }
      return { ...prev, [item.name]: { ...item, quantity: nextQty } };
    });
  };

  const cartItemsArray = Object.values(cart);
  const totalItemsCount = cartItemsArray.reduce((acc, curr) => acc + curr.quantity, 0);
  const totalPrice = cartItemsArray.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return menu_data.categories;
    const q = searchQuery.trim().toLowerCase();
    return menu_data.categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) => item.name.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [searchQuery, menu_data.categories]);

  const scrollToCategory = (name) => {
    setActiveCategory(name);
    const el = sectionRefs.current[name];
    if (el) {
      const yOffset = -132;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (searchQuery.trim()) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveCategory(entry.target.dataset.category);
        });
      },
      { rootMargin: '-160px 0px -65% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [searchQuery]);

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleCheckout = async () => {
    if (!customerInfo.name.trim()) return alert('Please enter your name to continue.');
    if (!customerInfo.email.trim() || !EMAIL_REGEX.test(customerInfo.email.trim())) {
      return alert('Please enter a valid email address (e.g., alex@example.com).');
    }
    setCheckoutStatus('submitting');
    setCheckoutError(null);

    let res;
    try {
      res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_token,
          customer_name: customerInfo.name,
          customer_email: customerInfo.email,
          notes: orderNotes || undefined,
          items: cartItemsArray.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity })),
        }),
      });
    } catch (networkErr) {
      setCheckoutStatus('error');
      setCheckoutError({ kind: 'network', message: 'Could not reach the server. Check your connection and try again.' });
      return;
    }

    let data = {};
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      if (data.detail === 'SESSION EXPIRED') {
        setCheckoutStatus('error');
        setCheckoutError({ kind: 'session', message: 'Your table session expired. Please rescan the QR code to continue.' });
        return;
      }
      setCheckoutStatus('error');
      setCheckoutError({ kind: 'order', message: data.detail || 'Something went wrong placing your order.' });
      return;
    }

    setOrderState(data.order_id);
    setCart({});
    setOrderNotes('');
    setCheckoutStatus('idle');
  };

  const handleSessionExpiredRestart = () => {
    localStorage.removeItem('acid_session');
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-40 selection:bg-[#D6FF00] selection:text-black relative overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-[#D6FF00]/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[500px] h-[500px] bg-[#00F0FF]/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-[#FF00FF]/10 rounded-full blur-[120px]" />
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-2xl bg-[#050505]/70 border-b border-white/10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-mono text-[10px] bg-white/5 backdrop-blur-md text-[#00F0FF] px-2.5 py-1 rounded-full border border-[#00F0FF]/30">
              TABLE {table_id}
            </span>
            <h1 className="text-2xl font-black uppercase tracking-tight mt-1.5 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              {menu_data.restaurant_name}
            </h1>
          </div>
          <div className="w-2.5 h-2.5 rounded-full bg-[#D6FF00] shadow-[0_0_12px_rgba(214,255,0,0.8)]" />
        </div>

        <div className="px-6 pb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes..."
              className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl py-3.5 pl-11 pr-10 text-sm font-mono text-white placeholder:text-white/25 focus:border-[#D6FF00]/50 focus:bg-white/[0.08] outline-none transition-all"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {!searchQuery.trim() && (
          <nav className="flex gap-2 px-6 pb-4 overflow-x-auto no-scrollbar">
            {menu_data.categories.map((cat) => (
              <button
                key={cat.category_name}
                onClick={() => scrollToCategory(cat.category_name)}
                className={`whitespace-nowrap font-mono text-xs px-4 py-2.5 rounded-full border transition-all ${
                  activeCategory === cat.category_name
                    ? 'bg-[#D6FF00] text-black border-[#D6FF00] font-bold shadow-[0_0_20px_rgba(214,255,0,0.35)]'
                    : 'bg-white/5 backdrop-blur-md text-white/50 border-white/10 hover:border-white/25 hover:bg-white/10'
                }`}
              >
                {cat.category_name}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10 space-y-16 relative z-10">
        {searchQuery.trim() && filteredCategories.length === 0 && (
          <div className="text-center py-16">
            <p className="font-mono text-white/40 text-sm">No dishes match &ldquo;{searchQuery}&rdquo;.</p>
          </div>
        )}

        {(searchQuery.trim() ? filteredCategories : menu_data.categories).map((cat) => {
          const themeColor =
            cat.theme === 'acid-cyan' ? 'text-[#00F0FF]' : cat.theme === 'acid-pink' ? 'text-[#FF00FF]' : 'text-[#D6FF00]';
          const themeBorder =
            cat.theme === 'acid-cyan' ? 'border-[#00F0FF]/30' : cat.theme === 'acid-pink' ? 'border-[#FF00FF]/30' : 'border-[#D6FF00]/30';

          return (
            <section
              key={cat.category_name}
              data-category={cat.category_name}
              ref={(el) => (sectionRefs.current[cat.category_name] = el)}
              className="space-y-6 scroll-mt-44"
            >
              <div className={`border-b ${themeBorder} pb-4 flex items-center justify-between`}>
                <h2 className={`text-3xl font-black uppercase tracking-tight ${themeColor}`}>{cat.category_name}</h2>
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
                        <DishImage item={item} theme={cat.theme} />
                      </div>

                      <div className="p-5 pt-4">
                        <div className="flex justify-between items-start gap-3 mb-1.5">
                          <h3 className="font-bold text-base leading-snug">{item.name}</h3>
                          <span className="font-mono font-black text-[#D6FF00] shrink-0 text-lg">
                            ${parseFloat(item.price).toFixed(2)}
                          </span>
                        </div>
                        {item.description && (
                          <p className="text-white/45 text-xs font-mono mb-4 leading-relaxed line-clamp-2">{item.description}</p>
                        )}

                        {!isBasicPlan ? (
                          <div className="flex items-center justify-between pt-3 border-t border-white/5">
                            {qty === 0 ? (
                              <button
                                onClick={() => updateQuantity(item, 1)}
                                className="w-full bg-white text-black font-mono font-black text-xs px-4 py-2.5 rounded-xl hover:bg-[#D6FF00] transition-colors"
                              >
                                + ADD TO ORDER
                              </button>
                            ) : (
                              <div className="w-full flex items-center justify-between gap-3 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
                                <button onClick={() => updateQuantity(item, -1)} className="text-white hover:text-[#FF00FF] p-1">
                                  <Minus size={16} />
                                </button>
                                <span className="font-mono font-bold text-sm">{qty} in order</span>
                                <button onClick={() => updateQuantity(item, 1)} className="text-white hover:text-[#D6FF00] p-1">
                                  <Plus size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[11px] font-mono text-zinc-400">
                            <span>Digital Menu Card</span>
                            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10">
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

      <AnimatePresence>
        {!isBasicPlan && totalItemsCount > 0 && !isCartOpen && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-xl z-40">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              className="bg-[#0a0a0a]/90 backdrop-blur-2xl border-2 border-[#D6FF00] p-4 rounded-3xl flex items-center justify-between shadow-[0_10px_50px_rgba(214,255,0,0.15)]"
            >
              <div className="flex items-center gap-3">
                <div className="bg-[#D6FF00] text-black font-mono font-black w-10 h-10 rounded-2xl flex items-center justify-center">
                  {totalItemsCount}
                </div>
                <div>
                  <p className="font-mono text-xs text-white/50">CART</p>
                  <p className="font-mono font-bold text-lg">${totalPrice.toFixed(2)}</p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(true)}
                className="bg-[#D6FF00] text-black font-mono font-black px-6 py-3 rounded-2xl hover:bg-white flex items-center gap-2 transition-colors"
              >
                <ShoppingBag size={16} /> REVIEW ORDER
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="w-full max-w-md bg-[#0a0a0a]/95 backdrop-blur-2xl border-l border-white/10 p-6 flex flex-col h-full overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur-2xl -mt-6 -mx-6 px-6 pt-6 z-10">
                <h2 className="text-xl font-black uppercase">Your Order</h2>
                <button onClick={() => setIsCartOpen(false)} className="font-mono text-xs text-white/50 hover:text-white flex items-center gap-1">
                  <X size={14} /> CLOSE
                </button>
              </div>

              <div className="space-y-3 mb-6">
                <h3 className="font-mono text-[10px] text-white/40 tracking-widest uppercase">Order summary</h3>
                {cartItemsArray.length === 0 ? (
                  <p className="font-mono text-xs text-white/30 py-6 text-center">Your cart is empty.</p>
                ) : (
                  cartItemsArray.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 bg-white/[0.04] backdrop-blur-md p-3 rounded-2xl border border-white/5">
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
                        <span className="font-mono text-xs text-[#00F0FF]">${item.price.toFixed(2)} each</span>
                      </div>
                      <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/10">
                        <button onClick={() => updateQuantity(item, -1)} className="text-white/60 hover:text-[#FF00FF] p-1">
                          <Minus size={12} />
                        </button>
                        <span className="font-mono font-bold text-xs w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item, 1)} className="text-white/60 hover:text-[#D6FF00] p-1">
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

              {cartItemsArray.length > 0 && (
                <div className="mb-6">
                  <label className="font-mono text-[10px] text-white/40 tracking-widest uppercase flex items-center gap-2 mb-2">
                    <MessageSquare size={12} /> Notes for the kitchen (optional)
                  </label>
                  <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Allergies, spice level, no onions..."
                    rows={2}
                    className="w-full bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-xl font-mono text-white text-xs placeholder:text-white/25 focus:border-[#D6FF00]/50 outline-none resize-none"
                  />
                </div>
              )}

              {cartItemsArray.length > 0 && (
                <div className="space-y-3 mb-6">
                  <h3 className="font-mono text-[10px] text-white/40 tracking-widest uppercase">Your details</h3>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                    className="w-full bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl font-mono text-white text-sm placeholder:text-white/25 focus:border-[#D6FF00]/50 outline-none"
                  />
                  <input
                    type="email"
                    placeholder="Email address"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                    className="w-full bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl font-mono text-white text-sm placeholder:text-white/25 focus:border-[#D6FF00]/50 outline-none"
                  />
                </div>
              )}

              <AnimatePresence>
                {checkoutStatus === 'error' && checkoutError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-4 bg-[#FF00FF]/5 backdrop-blur-md border border-[#FF00FF]/30 rounded-xl p-4"
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

              <div className="mt-auto pt-6 border-t border-white/10 space-y-4 sticky bottom-0 bg-[#0a0a0a]/95 backdrop-blur-2xl -mx-6 px-6 pb-2">
                <div className="flex justify-between font-mono text-lg font-bold">
                  <span>TOTAL:</span>
                  <span className="text-[#D6FF00]">${totalPrice.toFixed(2)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={cartItemsArray.length === 0 || checkoutStatus === 'submitting'}
                  className="w-full bg-[#D6FF00] text-black font-mono font-black py-4 rounded-2xl hover:bg-white transition-colors tracking-widest text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {checkoutStatus === 'submitting' ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> PLACING ORDER...
                    </>
                  ) : (
                    'PLACE ORDER'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {orderState && (
          <div className="fixed inset-0 z-50 bg-[#050505]/90 backdrop-blur-xl flex items-center justify-center p-6 text-center">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20 }}
              className="max-w-md w-full bg-white/[0.06] backdrop-blur-2xl border border-[#D6FF00]/50 p-10 rounded-[3rem] shadow-[0_20px_80px_rgba(214,255,0,0.1)]"
            >
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: 'spring', damping: 12 }}>
                <CheckCircle className="w-16 h-16 text-[#D6FF00] mx-auto mb-6" />
              </motion.div>
              <h2 className="text-3xl font-black uppercase mb-2">Order Placed</h2>
              <p className="font-mono text-xs text-[#00F0FF] mb-1">#{orderState}</p>
              <p className="font-mono text-xs text-white/50 mb-8">Sent to Table {table_id}. The kitchen has your order — sit tight.</p>
              <button
                onClick={() => {
                  setOrderState(null);
                  setIsCartOpen(false);
                }}
                className="w-full bg-white text-black font-mono font-black py-3 rounded-xl hover:bg-[#D6FF00] transition-colors"
              >
                CONTINUE BROWSING
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CustomerMenuApp;