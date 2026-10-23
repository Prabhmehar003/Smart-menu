// SettingsPage.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw, AlertTriangle, CheckCircle2, MapPin,
  Save, Crosshair, DollarSign, Phone, MapPin as AddressPin,
  Sparkles, ShoppingBag, UtensilsCrossed, ShieldCheck,
  Check, XCircle, Receipt,
} from 'lucide-react';
import { api } from '../src/api';


const CURRENCY_OPTIONS = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'SGD', 'AED'];

function FieldLabel({ children }) {
  return (
    <label className="font-mono text-xs font-bold tracking-wider text-amber-400 uppercase">
      {children}
    </label>
  );
}

function FieldHint({ children }) {
  return (
    <p className="font-mono text-[11px] mt-1.5 text-zinc-400">{children}</p>
  );
}

function SettingsPage({ t, onSaved, onThemeChange }) {
  const [settings, setSettings] = useState(() => {
    try {
      const cached = localStorage.getItem('smart_menu_settings_cache');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [form, setForm] = useState(() => {
    try {
      const cached = localStorage.getItem('smart_menu_settings_cache');
      if (cached) {
        const data = JSON.parse(cached);
        return {
          restaurant_name: data.restaurant_name || '',
          lat:             data.lat  != null ? String(data.lat)  : '',
          lon:             data.lon  != null ? String(data.lon)  : '',
          default_theme:   data.default_theme   || 'amber-gold',
          currency:        data.currency        || 'USD',
          tax_rate:        data.tax_rate        != null ? String(data.tax_rate)        : '',
          service_charge:  data.service_charge  != null ? String(data.service_charge)  : '',
          phone:           data.phone           || '',
          address:         data.address         || '',
          plan:            data.plan            || 'basic',
        };
      }
    } catch {}
    return {
      restaurant_name: '',
      lat: '',
      lon: '',
      geofence_enabled: false,
      geofence_radius: '1000',
      default_theme: 'amber-gold',
      currency: 'USD',
      tax_rate: '',
      service_charge: '',
      phone: '',
      address: '',
      plan: 'basic',
    };
  });
  const [loading, setLoading] = useState(() => {
    try {
      return !localStorage.getItem('smart_menu_settings_cache');
    } catch {
      return true;
    }
  });
  const [error, setError] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState(null);
  const [locating, setLocating] = useState(false);

  const set = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.getSettings();
      if (data) {
        setSettings(data);
        try {
          localStorage.setItem('smart_menu_settings_cache', JSON.stringify(data));
        } catch {}
        setForm((prev) => ({
          restaurant_name: data.restaurant_name || '',
          lat:             data.lat  != null ? String(data.lat)  : '',
          lon:             data.lon  != null ? String(data.lon)  : '',
          geofence_enabled: Boolean(data.geofence_enabled),
          geofence_radius:  data.geofence_radius != null ? String(data.geofence_radius) : '1000',
          default_theme:   data.default_theme   || 'amber-gold',
          currency:        data.currency        || 'USD',
          tax_rate:        data.tax_rate        != null ? String(data.tax_rate)        : '',
          service_charge:  data.service_charge  != null ? String(data.service_charge)  : '',
          phone:           data.phone           || '',
          address:         data.address         || '',
          plan:            data.plan            || prev.plan || 'basic',
        }));
      }
    } catch (e) {
      setError(e.message || 'Could not load settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSelectPlan = async (newPlan) => {
    // 1. Immediately update local form state
    setForm((f) => ({ ...f, plan: newPlan }));

    // 2. Immediately update local settings state & cache
    setSettings((prev) => {
      const next = { ...(prev || {}), plan: newPlan };
      try {
        localStorage.setItem('smart_menu_settings_cache', JSON.stringify(next));
      } catch {}
      return next;
    });

    // 3. Dispatch events to AdminPortal and App immediately
    const updatedPayload = { ...(settings || {}), plan: newPlan };
    onSaved?.(updatedPayload);
    window.dispatchEvent(new CustomEvent('smart_menu_settings_updated', { detail: updatedPayload }));

    // 4. Auto-save immediately to backend so page navigation never loses the plan
    try {
      const saved = await api.updateSettings({ plan: newPlan });
      if (saved) {
        setSettings(saved);
        try {
          localStorage.setItem('smart_menu_settings_cache', JSON.stringify(saved));
        } catch {}
        onSaved?.(saved);
        window.dispatchEvent(new CustomEvent('smart_menu_settings_updated', { detail: saved }));
      }
    } catch (err) {
      console.error('Failed to auto-save plan:', err);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          lat: String(pos.coords.latitude),
          lon: String(pos.coords.longitude),
        }));
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 8000 }
    );
  };

  const handleClearGeofence = () => {
    setForm((f) => ({ ...f, lat: '', lon: '', geofence_enabled: false }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const payload = {};
      if (form.restaurant_name) payload.restaurant_name = form.restaurant_name;
      payload.geofence_enabled = Boolean(form.geofence_enabled);
      payload.geofence_radius = parseFloat(form.geofence_radius) || 1000;
      if (!form.geofence_enabled || (form.lat === '' && form.lon === '')) {
        payload.clear_geofence = true;
      } else {
        if (form.lat !== '') payload.lat = parseFloat(form.lat);
        if (form.lon !== '') payload.lon = parseFloat(form.lon);
      }
      if (form.default_theme)        payload.default_theme  = form.default_theme;
      if (form.currency)             payload.currency       = form.currency;
      if (form.tax_rate !== '')      payload.tax_rate       = parseFloat(form.tax_rate);
      if (form.service_charge !== '') payload.service_charge = parseFloat(form.service_charge);
      if (form.phone)                payload.phone          = form.phone;
      if (form.address)              payload.address        = form.address;
      if (form.plan)                 payload.plan           = form.plan;

      const updated = await api.updateSettings(payload);
      setSettings(updated);
      try {
        localStorage.setItem('smart_menu_settings_cache', JSON.stringify(updated));
      } catch {}
      onSaved?.(updated);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (e) {
      setSaveStatus('error');
      setSaveError(e.message || 'Could not save settings.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-28">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
          <p className="font-mono text-xs text-zinc-500">Loading restaurant settings...</p>
        </div>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="relative rounded-[28px] border border-rose-500/30 bg-[#0a0d14]/75 backdrop-blur-2xl p-10 max-w-lg shadow-2xl">
        <AlertTriangle className="w-8 h-8 text-rose-400 mb-4" />
        <h2 className="font-bold text-lg mb-2 text-white">Couldn't load settings</h2>
        <p className="font-mono text-xs mb-6 text-zinc-400">{error}</p>
        <button
          onClick={load}
          className="font-mono text-xs font-bold px-5 py-3 rounded-xl border border-white/10 bg-white/5 text-white hover:border-amber-400/40 hover:bg-amber-500/10 hover:text-amber-400 flex items-center gap-2 transition-all shadow-md"
        >
          <RefreshCw size={14} /> RETRY
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen px-3 sm:px-6 lg:px-12 xl:px-16 py-4 sm:py-6 pb-28 lg:pb-20 max-w-[1700px] mx-auto">
      {/* Ambient background glow & subtle dot pattern */}
      <div className="absolute inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[800px] h-[700px] rounded-full blur-[160px] bg-gradient-to-br from-amber-500/12 via-orange-500/6 to-transparent" />
        <div className="absolute top-1/2 -right-40 w-[600px] h-[600px] rounded-full blur-[150px] bg-gradient-to-tl from-cyan-500/6 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:28px_28px] opacity-40" />
      </div>

      <div className="mb-7">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
          Settings
        </h1>
        <p className="font-mono text-xs mt-1.5 text-zinc-400">
          Restaurant identity, billing configuration, and geofence.
        </p>
      </div>

      <form onSubmit={handleSave} className="relative rounded-2xl sm:rounded-[28px] border border-white/10 bg-[#0a0d14]/75 backdrop-blur-2xl p-4 sm:p-7 lg:p-10 max-w-3xl shadow-2xl overflow-hidden">
        {/* Specular top rim line */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />

        <div className="space-y-8">

          {/* ── Identity ───────────────────────────────────────────── */}
          <section>
            <h3 className="font-mono text-[11px] uppercase tracking-widest mb-4 text-zinc-400 font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Identity
            </h3>
            <div className="space-y-5">
              <div>
                <FieldLabel>RESTAURANT NAME</FieldLabel>
                <input
                  type="text"
                  value={form.restaurant_name}
                  onChange={set('restaurant_name')}
                  placeholder="Your restaurant's name"
                  className="w-full mt-2 border border-white/10 bg-[#05070a]/90 p-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                />
                <FieldHint>
                  Shown at the top of the guest menu and on printed invoices.
                </FieldHint>
              </div>

              <div>
                <FieldLabel>PHONE NUMBER</FieldLabel>
                <div className="relative mt-2">
                  <Phone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={set('phone')}
                    placeholder="+1 (555) 000-0000"
                    className="w-full border border-white/10 bg-[#05070a]/90 p-4 pl-10 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                  />
                </div>
                <FieldHint>Printed on PDF invoices.</FieldHint>
              </div>

              <div>
                <FieldLabel>ADDRESS</FieldLabel>
                <div className="relative mt-2">
                  <AddressPin size={14} className="absolute left-4 top-3.5 text-zinc-500" />
                  <textarea
                    value={form.address}
                    onChange={set('address')}
                    rows={2}
                    placeholder="123 Main St, City, Country"
                    className="w-full border border-white/10 bg-[#05070a]/90 p-4 pl-10 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all resize-none shadow-inner"
                  />
                </div>
                <FieldHint>Printed on PDF invoices.</FieldHint>
              </div>
            </div>
          </section>


          {/* ── Plan & Capabilities ─────────────────────────────────── */}
          <section>
            <h3 className="font-mono text-[11px] uppercase tracking-widest mb-4 text-zinc-400 font-bold flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Plan & Capabilities
            </h3>
            
            {/* Two plan cards matching Signup page styling */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. BASIC PLAN */}
              <div
                onClick={() => handleSelectPlan('basic')}
                className={`relative flex flex-col justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                  form.plan === 'basic'
                    ? 'border-neutral-200 bg-neutral-900/90 shadow-lg'
                    : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black tracking-tight text-white font-sans">Basic</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700 font-mono">
                        Digital Menu
                      </span>
                    </div>
                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        form.plan === 'basic' ? 'border-white bg-white text-black' : 'border-neutral-600'
                      }`}
                    >
                      {form.plan === 'basic' && <div className="h-2 w-2 rounded-full bg-black" />}
                    </div>
                  </div>

                  <p className="text-xs mb-4 text-neutral-400 leading-relaxed font-sans">
                    Only digital menu provided for your restaurant. Diners scan table QR codes to view dishes and prices on their mobile devices.
                  </p>

                  <div className="space-y-2 border-t border-neutral-800/80 pt-3 text-xs font-sans">
                    <div className="flex items-center gap-2 text-neutral-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Dynamic Table QR Cards</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>HD Digital Menu Showcase</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-300">
                      <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Dish Descriptions & Dietary Tags</span>
                    </div>
                    <div className="flex items-center gap-2 text-neutral-500 line-through">
                      <XCircle className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
                      <span>Direct Food Ordering Disabled</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-neutral-800 text-center">
                  <span className="text-xs font-semibold text-neutral-300 font-mono">
                    {form.plan === 'basic' ? '● Selected Plan' : 'Click to select Basic'}
                  </span>
                </div>
              </div>

              {/* 2. PRO PLAN */}
              <div
                onClick={() => handleSelectPlan('pro')}
                className={`relative flex flex-col justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                  form.plan === 'pro'
                    ? 'border-lime-400 bg-lime-950/20 shadow-xl shadow-lime-500/10'
                    : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700'
                }`}
              >
                {/* Highlight ribbon */}
                <div className="absolute -top-3 right-4 bg-gradient-to-r from-lime-400 to-emerald-400 text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md font-sans">
                  Recommended
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black tracking-tight text-white font-sans">Pro Plan</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-lime-400/20 text-lime-400 border border-lime-400/40 font-mono">
                        Menu + Ordering
                      </span>
                    </div>
                    <div
                      className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        form.plan === 'pro' ? 'border-lime-400 bg-lime-400 text-black' : 'border-neutral-600'
                      }`}
                    >
                      {form.plan === 'pro' && <div className="h-2 w-2 rounded-full bg-black" />}
                    </div>
                  </div>

                  <p className="text-xs mb-4 text-neutral-300 leading-relaxed font-sans">
                    Digital menu <strong className="text-lime-400">PLUS interactive food ordering</strong>. Customers can view the menu AND place orders directly from their tables.
                  </p>

                  <div className="space-y-2 border-t border-neutral-800/80 pt-3 text-xs font-sans">
                    <div className="flex items-center gap-2 text-white font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                      <span>Everything in Basic Plan</span>
                    </div>
                    <div className="flex items-center gap-2 text-lime-300 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                      <span>Food Ordering Feature Enabled</span>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <CheckCircle2 className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                      <span>Live Table Cart & Custom Dish Notes</span>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <CheckCircle2 className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                      <span>Real-Time Kitchen Orders Dashboard</span>
                    </div>
                    <div className="flex items-center gap-2 text-white">
                      <CheckCircle2 className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                      <span>Instant Digital Invoices & Receipts</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-neutral-800 text-center">
                  <span className={`text-xs font-bold font-mono ${form.plan === 'pro' ? 'text-lime-400' : 'text-neutral-300'}`}>
                    {form.plan === 'pro' ? '✓ Selected Pro Plan' : 'Click to select Pro'}
                  </span>
                </div>
              </div>
            </div>
          </section>


          {/* ── Billing (Only visible when Pro Plan is selected) ────────────── */}
          <AnimatePresence>
            {form.plan === 'pro' && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <section className="rounded-2xl border border-lime-400/30 bg-lime-950/10 p-6 space-y-5">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-lime-400" />
                    <h3 className="font-mono text-[11px] uppercase tracking-widest text-lime-400 font-bold">
                      Billing & Tax Configuration (Pro Ordering Feature)
                    </h3>
                  </div>
                  <p className="font-mono text-xs text-zinc-400">
                    Tax and service charge are applied to invoice totals (both admin PDF and customer receipt).
                  </p>

                  <div className="space-y-5">
                    <div>
                      <FieldLabel>CURRENCY</FieldLabel>
                      <div className="relative mt-2">
                        <DollarSign size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <select
                          value={form.currency}
                          onChange={set('currency')}
                          className="w-full border border-white/10 bg-[#05070a]/90 p-4 pl-10 rounded-xl font-mono text-sm text-white outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400/30 transition-all appearance-none cursor-pointer"
                        >
                          {CURRENCY_OPTIONS.map((c) => (
                            <option key={c} value={c} className="bg-[#0e131f] text-white">{c}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <FieldLabel>TAX RATE (%)</FieldLabel>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={form.tax_rate}
                          onChange={set('tax_rate')}
                          placeholder="e.g. 8.25"
                          className="w-full mt-2 border border-white/10 bg-[#05070a]/90 p-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400/30 transition-all shadow-inner"
                        />
                      </div>
                      <div>
                        <FieldLabel>SERVICE CHARGE (%)</FieldLabel>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={form.service_charge}
                          onChange={set('service_charge')}
                          placeholder="e.g. 5"
                          className="w-full mt-2 border border-white/10 bg-[#05070a]/90 p-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-lime-400 focus:ring-1 focus:ring-lime-400/30 transition-all shadow-inner"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Geofence ───────────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-[11px] uppercase tracking-widest text-zinc-400 font-bold flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${form.geofence_enabled ? 'bg-amber-400' : 'bg-zinc-600'}`} /> Geofence Verification
              </h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(form.geofence_enabled)}
                  onChange={(e) => setForm((f) => ({ ...f, geofence_enabled: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-400"></div>
              </label>
            </div>

            {form.geofence_enabled ? (
              <div className="space-y-4">
                <p className="font-mono text-[11px] text-zinc-400 leading-relaxed">
                  Guests must scan within the specified distance of your restaurant GPS coordinates, or their scan will be rejected.
                </p>
                <div className="flex items-center justify-between">
                  <FieldLabel>RESTAURANT LOCATION (LAT / LON)</FieldLabel>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      disabled={locating}
                      className="font-mono text-[11px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-zinc-300 hover:border-amber-400/40 hover:text-amber-400 transition-all disabled:opacity-50"
                    >
                      {locating
                        ? <><RefreshCw size={11} className="animate-spin text-amber-400" /> Locating...</>
                        : <><Crosshair size={11} className="text-amber-400" /> Use current location</>}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearGeofence}
                      className="font-mono text-[11px] font-bold px-3 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-all"
                    >
                      Reset GPS
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <MapPin size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="number" step="any"
                      value={form.lat} onChange={set('lat')}
                      placeholder="Latitude"
                      className="w-full border border-white/10 bg-[#05070a]/90 p-4 pl-10 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                    />
                  </div>
                  <input
                    type="number" step="any"
                    value={form.lon} onChange={set('lon')}
                    placeholder="Longitude"
                    className="w-full border border-white/10 bg-[#05070a]/90 p-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                  />
                </div>
                <div>
                  <FieldLabel>ALLOWED RADIUS (METERS)</FieldLabel>
                  <input
                    type="number"
                    min="50"
                    step="50"
                    value={form.geofence_radius}
                    onChange={set('geofence_radius')}
                    placeholder="e.g. 1000"
                    className="w-full mt-1 border border-white/10 bg-[#05070a]/90 p-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                  />
                  <span className="text-[10px] text-zinc-500 font-mono mt-1 block">
                    Recommended: 1000 m (1 km) to prevent false rejections from cell tower inaccuracies and indoor GPS drift.
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left">
                <p className="font-mono text-xs text-amber-400 font-bold mb-1">
                  Geofence Check: Disabled (Recommended)
                </p>
                <p className="font-mono text-[11px] text-zinc-400 leading-relaxed">
                  Anyone scanning the table QR code can freely browse the digital menu and order without location or distance verification errors.
                </p>
              </div>
            )}
          </section>

          {/* ── Active menu info ────────────────────────────────────── */}
          {settings?.menu_id && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 font-bold">
                Active Menu Catalog
              </p>
              <p className="font-mono text-xs mt-1 text-zinc-300">
                ID: <span className="text-amber-400 font-bold">{settings.menu_id}</span>
              </p>
            </div>
          )}
        </div>

        {/* Save error */}
        <AnimatePresence>
          {saveStatus === 'error' && saveError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4"
            >
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
              <p className="font-mono text-xs text-rose-300">{saveError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="submit"
          disabled={saveStatus === 'saving'}
          className="mt-8 font-mono font-black text-xs px-8 py-4 rounded-xl transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black shadow-[0_0_25px_rgba(245,158,11,0.25)] hover:shadow-[0_0_35px_rgba(245,158,11,0.4)] active:scale-[0.99] font-bold"
        >
          {saveStatus === 'saving' ? (
            <><RefreshCw size={14} className="animate-spin" /> SAVING SETTINGS...</>
          ) : saveStatus === 'saved' ? (
            <><CheckCircle2 size={14} /> CHANGES SAVED</>
          ) : (
            <><Save size={14} /> SAVE RESTAURANT SETTINGS</>
          )}
        </button>
      </form>
    </div>
  );
}

export default SettingsPage;
