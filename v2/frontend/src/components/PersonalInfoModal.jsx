import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Globe,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  ShieldCheck,
  Edit3,
} from 'lucide-react';
import { api } from '../api';
import { auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

export default function PersonalInfoModal({ isOpen, onClose, user, onUserUpdated }) {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    countryCode: '+1',
    phoneNumber: '',
    addressLine: '',
    city: '',
    region: '',
    postalCode: '',
    country: '',
  });

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [errorMessage, setErrorMessage] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Sync form when modal opens or user prop changes
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        email: user.email || '',
        countryCode: user.country_code || user.countryCode || '+1',
        phoneNumber: user.phone_number || user.phoneNumber || '',
        addressLine: user.address_line || user.addressLine || '',
        city: user.city || '',
        region: user.region || user.state || '',
        postalCode: user.postal_code || user.postalCode || '',
        country: user.country || '',
      });
    }
  }, [user, isOpen]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (saveStatus !== 'idle') setSaveStatus('idle');
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveStatus('saving');
    setErrorMessage(null);

    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        countryCode: form.countryCode.trim(),
        phoneNumber: form.phoneNumber.trim(),
        addressLine: form.addressLine.trim(),
        city: form.city.trim(),
        region: form.region.trim(),
        postalCode: form.postalCode.trim(),
        country: form.country.trim(),
      };

      const res = await api.updateProfile(payload);
      const updatedUser = res?.user || { ...user, ...payload };

      // Update localStorage session
      try {
        localStorage.setItem('acid_session', JSON.stringify(updatedUser));
      } catch (_) {}

      onUserUpdated?.(updatedUser);
      setSaveStatus('saved');
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2500);
    } catch (err) {
      console.error('Failed to update personal info:', err);
      setSaveStatus('error');
      setErrorMessage(err.message || 'Could not update profile information.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await api.logout().catch(() => {});
      if (auth.currentUser) {
        await auth.signOut().catch(() => {});
      }
    } catch (_) {}

    try {
      localStorage.removeItem('acid_session');
      localStorage.removeItem('smart_menu_remembered_email');
    } catch (_) {}

    setLoggingOut(false);
    onClose();
    navigate('/login');
  };

  if (!isOpen) return null;

  // Calculate initials
  const initials = (form.name || user?.name || 'Admin')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('') || 'AD';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-2xl bg-[#0c0e14]/95 border border-white/15 rounded-2xl sm:rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.8)] overflow-hidden z-10 my-4 sm:my-8"
        >
          {/* Ambient header glow */}
          <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent pointer-events-none" />
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/30 to-transparent pointer-events-none" />

          {/* Header Bar */}
          <div className="relative px-4 sm:px-8 pt-5 sm:pt-7 pb-4 sm:pb-5 border-b border-white/10 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              {/* Avatar circle */}
              <div className="relative shrink-0">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 text-black font-mono font-black text-lg sm:text-xl flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.35)]">
                  {user?.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={form.name}
                      className="w-full h-full object-cover rounded-2xl"
                    />
                  ) : (
                    initials
                  )}
                </div>
                <div className="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 border-2 border-[#0c0e14] flex items-center justify-center" title="Active">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-tight truncate">
                    {form.name || 'Admin Profile'}
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck size={11} /> ADMIN
                  </span>
                </div>
                <p className="font-mono text-xs text-zinc-400 mt-0.5 truncate">
                  {form.email || user?.email || 'manager@restaurant.com'}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSave} className="p-4 sm:p-8 space-y-5 sm:space-y-6 max-h-[75vh] overflow-y-auto">
            {/* Section Tag */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 size={14} className="text-amber-400" />
                <span className="font-mono text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Personal & Contact Details
                </span>
              </div>
              <span className="font-mono text-[11px] text-zinc-500">
                Directly editable
              </span>
            </div>

            {/* Grid of Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={form.name}
                    onChange={handleChange('name')}
                    placeholder="Your Full Name"
                    required
                    className="w-full border border-white/10 bg-[#05070a]/90 py-3 pl-10 pr-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="sm:col-span-2">
                <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="email"
                    value={form.email}
                    onChange={handleChange('email')}
                    placeholder="email@example.com"
                    required
                    className="w-full border border-white/10 bg-[#05070a]/90 py-3 pl-10 pr-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Country Code */}
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  Country Code
                </label>
                <div className="relative">
                  <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={form.countryCode}
                    onChange={handleChange('countryCode')}
                    placeholder="+1, +91, +44"
                    className="w-full border border-white/10 bg-[#05070a]/90 py-3 pl-10 pr-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Phone Number */}
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="tel"
                    value={form.phoneNumber}
                    onChange={handleChange('phoneNumber')}
                    placeholder="(555) 000-0000"
                    className="w-full border border-white/10 bg-[#05070a]/90 py-3 pl-10 pr-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Street Address */}
              <div className="sm:col-span-2">
                <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  Address Line
                </label>
                <div className="relative">
                  <MapPin size={15} className="absolute left-3.5 top-3.5 text-zinc-500" />
                  <textarea
                    rows={2}
                    value={form.addressLine}
                    onChange={handleChange('addressLine')}
                    placeholder="123 Main St, Suite 400"
                    className="w-full border border-white/10 bg-[#05070a]/90 py-3 pl-10 pr-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all resize-none shadow-inner"
                  />
                </div>
              </div>

              {/* City */}
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  City
                </label>
                <div className="relative">
                  <Building size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <input
                    type="text"
                    value={form.city}
                    onChange={handleChange('city')}
                    placeholder="City"
                    className="w-full border border-white/10 bg-[#05070a]/90 py-3 pl-10 pr-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* State / Region */}
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  State / Region
                </label>
                <input
                  type="text"
                  value={form.region}
                  onChange={handleChange('region')}
                  placeholder="State / Province"
                  className="w-full border border-white/10 bg-[#05070a]/90 py-3 px-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                />
              </div>

              {/* Country */}
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  Country
                </label>
                <input
                  type="text"
                  value={form.country}
                  onChange={handleChange('country')}
                  placeholder="Country"
                  className="w-full border border-white/10 bg-[#05070a]/90 py-3 px-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                />
              </div>

              {/* Postal / Zip Code */}
              <div>
                <label className="block font-mono text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-1.5">
                  Postal Code / Zip
                </label>
                <input
                  type="text"
                  value={form.postalCode}
                  onChange={handleChange('postalCode')}
                  placeholder="Postal Code"
                  className="w-full border border-white/10 bg-[#05070a]/90 py-3 px-4 rounded-xl font-mono text-sm text-white placeholder-zinc-500 outline-none focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/30 transition-all shadow-inner"
                />
              </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {saveStatus === 'error' && errorMessage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 flex items-start gap-2.5 text-xs text-rose-300 font-mono"
                >
                  <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
              {/* Sign Out Button */}
              <button
                type="button"
                onClick={handleSignOut}
                disabled={loggingOut}
                className="w-full sm:w-auto px-4 py-3 rounded-xl border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loggingOut ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <LogOut size={14} />
                )}
                <span>SIGN OUT</span>
              </button>

              {/* Save Changes Button */}
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-7 py-3 rounded-xl font-mono text-xs font-black tracking-wider uppercase bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:shadow-[0_0_30px_rgba(245,158,11,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>SAVING...</span>
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <CheckCircle2 size={14} className="text-black" />
                    <span>CHANGES SAVED</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>SAVE CHANGES</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
