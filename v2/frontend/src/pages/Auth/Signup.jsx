// src/pages/Auth/Signup.jsx
//
// Modern, structured sign-up page tailored for Smart Menu restaurants.
// Organized into 4 dedicated cards:
//   1. Major Card: Account Credentials (Email ID & Password)
//   2. Account Info: Name, Number, Country Code, Address, City, State, Postal Code
//   3. Restaurant Info & Billing: Restaurant Name, Phone, Address + Currency, Tax Rate (%), Service Charge (%)
//   4. Plan Selection: Two interactive small cards (Basic Plan vs Pro Plan)

import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  linkWithCredential,
  updatePassword,
  EmailAuthProvider,
} from 'firebase/auth';
import {
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  Building2,
  Receipt,
  Sparkles,
  CheckCircle2,
  Check,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { auth } from '../../lib/firebase';
import AuthLayout from '../../layouts/AuthLayout';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
const googleProvider = new GoogleAuthProvider();

const COUNTRY_CODES = [
  { code: '+1', label: '+1 (US / Canada)' },
  { code: '+91', label: '+91 (India)' },
  { code: '+44', label: '+44 (UK)' },
  { code: '+61', label: '+61 (Australia)' },
  { code: '+971', label: '+971 (UAE)' },
  { code: '+49', label: '+49 (Germany)' },
  { code: '+33', label: '+33 (France)' },
  { code: '+81', label: '+81 (Japan)' },
  { code: '+65', label: '+65 (Singapore)' },
  { code: '+64', label: '+64 (New Zealand)' },
];

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($) - US Dollar' },
  { code: 'EUR', symbol: '€', label: 'EUR (€) - Euro' },
  { code: 'GBP', symbol: '£', label: 'GBP (£) - British Pound' },
  { code: 'INR', symbol: '₹', label: 'INR (₹) - Indian Rupee' },
  { code: 'CAD', symbol: '$', label: 'CAD ($) - Canadian Dollar' },
  { code: 'AUD', symbol: '$', label: 'AUD ($) - Australian Dollar' },
  { code: 'JPY', symbol: '¥', label: 'JPY (¥) - Japanese Yen' },
  { code: 'AED', symbol: 'AED', label: 'AED (د.إ) - UAE Dirham' },
  { code: 'SGD', symbol: '$', label: 'SGD ($) - Singapore Dollar' },
];

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();

  // 1. Credentials
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [googleUser, setGoogleUser] = useState(null);

  // 2. Account Info
  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // 3. Restaurant Info & Billing
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxRate, setTaxRate] = useState('8.25');
  const [serviceCharge, setServiceCharge] = useState('5.00');

  // 4. Plan Selection ('basic' | 'pro')
  const queryParams = new URLSearchParams(location.search);
  const initialPlan = queryParams.get('plan') === 'basic' ? 'basic' : 'pro';
  const [plan, setPlan] = useState(initialPlan);

  // UI state
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Ensure form starts completely blank with no email ID or name by default
  useEffect(() => {
    if (auth.currentUser) {
      auth.signOut().catch(() => {});
    }
  }, []);

  async function handleGoogleAuth() {
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setGoogleUser(result.user);
      if (result.user.displayName && !name) setName(result.user.displayName);
      if (result.user.email) setEmail(result.user.email);
    } catch (err) {
      setError(err.message || 'Google authentication failed.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    // Basic validation
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please provide an email address.');
      return;
    }
    // Password is now strictly required for all accounts
    if (!password || password.length < 6) {
      setError('Password is required and must be at least 6 characters.');
      return;
    }
    if (!name.trim()) {
      setError('Please provide your account name.');
      return;
    }
    if (!restaurantName.trim()) {
      setError('Please provide your restaurant name.');
      return;
    }

    setSubmitting(true);

    try {
      // 1. Firebase Identity creation & password setup
      let firebaseUser = auth.currentUser;
      const isGoogleForThisEmail =
        firebaseUser &&
        firebaseUser.email &&
        firebaseUser.email.toLowerCase() === cleanEmail.toLowerCase();

      if (isGoogleForThisEmail) {
        // User authenticated with Google for this email.
        // Link email + password credential so they can log in via password OR Google!
        try {
          const credential = EmailAuthProvider.credential(cleanEmail, password);
          await linkWithCredential(firebaseUser, credential);
        } catch (linkErr) {
          console.warn('linkWithCredential notice:', linkErr?.code, linkErr?.message);
          if (
            linkErr?.code === 'auth/provider-already-linked' ||
            linkErr?.code === 'auth/credential-already-in-use'
          ) {
            try {
              await updatePassword(firebaseUser, password);
            } catch (upErr) {
              console.warn('updatePassword error:', upErr);
            }
          }
        }
      } else {
        // If a different Google session was active, sign out first
        if (firebaseUser) {
          try {
            await auth.signOut();
          } catch (_) {}
        }
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        firebaseUser = cred.user;
      }
      const idToken = await firebaseUser.getIdToken();

      // 2. Register user session in backend (mode: 'signup' creates users row in PostgreSQL)
      const sessionRes = await fetch(`${API_BASE}/api/auth/session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          name: name.trim(),
          role: 'provider',
          mode: 'signup',
          deviceType: 'web',
          deviceName: navigator.userAgent,
        }),
      });

      if (!sessionRes.ok) {
        const body = await sessionRes.json().catch(() => ({}));
        throw new Error(body.message || body.detail || 'Could not create account.');
      }

      // 3. Save all Account Info + Restaurant Info + Billing + Plan in database
      const profileRes = await fetch(`${API_BASE}/api/auth/complete-profile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phoneNumber: phoneNumber.trim(),
          countryCode,
          addressLine: addressLine.trim(),
          city: city.trim(),
          region: state.trim(),
          postalCode: postalCode.trim(),
          restaurantName: restaurantName.trim(),
          restaurantPhone: restaurantPhone.trim() || phoneNumber.trim(),
          restaurantAddress: restaurantAddress.trim() || addressLine.trim(),
          currency,
          taxRate: parseFloat(taxRate) || 0,
          serviceCharge: parseFloat(serviceCharge) || 0,
          plan,
        }),
      });

      const profileData = await profileRes.json().catch(() => ({}));
      const finalUser = profileData.user || {};

      // Save user session in local storage
      localStorage.setItem('acid_session', JSON.stringify(finalUser));
      localStorage.setItem(
        'smart_menu_restaurant_setup',
        JSON.stringify({
          restaurant_name: restaurantName.trim(),
          phone: restaurantPhone.trim() || phoneNumber.trim(),
          address: restaurantAddress.trim() || addressLine.trim(),
          currency,
          tax_rate: parseFloat(taxRate) || 0,
          service_charge: parseFloat(serviceCharge) || 0,
          plan,
        })
      );

      // Navigate straight to dashboard
      navigate('/admin');
    } catch (err) {
      console.error('Sign-up error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password accounts are disabled in your Firebase Console. Please enable "Email/Password" under Authentication > Sign-in method in Firebase Console.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email address is already registered. Please go to the sign-in page to log in.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else {
        setError(err.message || 'Something went wrong during account creation.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const cardStyle = {
    backgroundColor: 'var(--color-bg, #0d0f14)',
    borderColor: 'var(--color-border, #27272a)',
  };

  const inputStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'var(--color-border, #27272a)',
    color: 'var(--color-fg, #ffffff)',
  };

  return (
    <AuthLayout
      maxWidth="max-w-2xl lg:max-w-3xl"
      title="Create Your Restaurant Account"
      subtitle="Register your credentials, restaurant details, billing configuration, and select your plan."
      footer={
        <span>
          Already have an account?{' '}
          <Link
            to="/signin"
            className="font-medium hover:underline"
            style={{ color: 'var(--color-accent, #84cc16)' }}
          >
            Sign in here
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-left">
        {/* ========================================================================= */}
        {/* CARD 1: MAJOR CARD - ACCOUNT CREDENTIALS                                 */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border p-5 sm:p-6 transition-all" style={cardStyle}>
          <div className="flex items-center justify-between gap-3 mb-5 border-b pb-4" style={{ borderColor: 'var(--color-border, #27272a)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold"
                style={{
                  backgroundColor: 'rgba(132, 204, 22, 0.1)',
                  borderColor: 'var(--color-accent, #84cc16)',
                  color: 'var(--color-accent, #84cc16)',
                }}
              >
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  1. Account Credentials
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                  Email ID and password used to access your restaurant dashboard
                </p>
              </div>
            </div>
            <span
              className="text-[11px] font-mono uppercase px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'var(--color-border, #27272a)',
                color: 'var(--color-muted, #a1a1aa)',
              }}
            >
              Step 1 of 4
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                Email ID <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="manager@restaurant.com"
                  required
                  className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-lime-400"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                Password <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a password (min 6 characters)"
                  required
                  minLength={6}
                  className="w-full rounded-xl border pl-10 pr-11 py-2.5 text-sm outline-none transition focus:border-lime-400"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 p-1 text-neutral-400 hover:text-white transition"
                  tabIndex={-1}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Password is required for all new accounts so you can sign in anytime using your email & password or via Google.
              </p>
            </div>

            {/* Google Authentication Status or Button - dynamically synced with typed email */}
            {email.trim() ? (
              googleUser && googleUser.email?.toLowerCase() === email.trim().toLowerCase() ? (
                <div
                  className="flex items-center gap-2 p-3 rounded-xl border text-xs"
                  style={{
                    backgroundColor: 'rgba(132, 204, 22, 0.08)',
                    borderColor: 'var(--color-accent, #84cc16)',
                    color: 'var(--color-accent, #84cc16)',
                  }}
                >
                  <ShieldCheck className="w-4 h-4 flex-shrink-0 text-lime-400" />
                  <span>Connected with Google as <strong>{email.trim()}</strong></span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-3 rounded-xl border text-xs bg-neutral-900/60 border-neutral-800">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <Mail className="w-4 h-4 flex-shrink-0 text-lime-400" />
                    <span>Registering account with: <strong className="text-white">{email.trim()}</strong></span>
                  </div>
                  {googleUser && (
                    <button
                      type="button"
                      onClick={() => setEmail(googleUser.email)}
                      className="text-[11px] font-medium text-lime-400 hover:underline"
                    >
                      Use Google email ({googleUser.email})
                    </button>
                  )}
                </div>
              )
            ) : (
              !googleUser && (
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-xs font-medium text-neutral-300 hover:text-white hover:bg-white/5 transition"
                  style={{ borderColor: 'var(--color-border, #27272a)' }}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Or autofill with Google</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 2: ACCOUNT INFO                                                     */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border p-5 sm:p-6 transition-all" style={cardStyle}>
          <div className="flex items-center justify-between gap-3 mb-5 border-b pb-4" style={{ borderColor: 'var(--color-border, #27272a)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold"
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  borderColor: '#38bdf8',
                  color: '#38bdf8',
                }}
              >
                <User className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  2. Account Information
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                  Personal and contact details of the restaurant administrator
                </p>
              </div>
            </div>
            <span
              className="text-[11px] font-mono uppercase px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'var(--color-border, #27272a)',
                color: 'var(--color-muted, #a1a1aa)',
              }}
            >
              Step 2 of 4
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                Full Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Chef Marco Rossi"
                  required
                  className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-sky-400"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Country Code */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                Country Code <span className="text-red-400">*</span>
              </label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-sky-400 appearance-none bg-neutral-900 cursor-pointer"
                style={inputStyle}
              >
                {COUNTRY_CODES.map((item) => (
                  <option key={item.code} value={item.code}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                Phone Number
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400 pointer-events-none" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="(555) 000-1234"
                  className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-sky-400"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Address */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                Address Line
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={addressLine}
                  onChange={(e) => setAddressLine(e.target.value)}
                  placeholder="Street address, suite, or flat"
                  className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-sky-400"
                  style={inputStyle}
                />
              </div>
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. San Francisco"
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-sky-400"
                style={inputStyle}
              />
            </div>

            {/* State / Region */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                State / Region
              </label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="e.g. California"
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-sky-400"
                style={inputStyle}
              />
            </div>

            {/* Postal Code */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                Postal Code / ZIP
              </label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="e.g. 94103"
                className="w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition focus:border-sky-400"
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 3: RESTAURANT INFORMATION                                           */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border p-5 sm:p-6 transition-all" style={cardStyle}>
          <div className="flex items-center justify-between gap-3 mb-5 border-b pb-4" style={{ borderColor: 'var(--color-border, #27272a)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.1)',
                  borderColor: '#f59e0b',
                  color: '#f59e0b',
                }}
              >
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  3. Restaurant Information
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                  Establishment name, telephone contact, and restaurant physical location
                </p>
              </div>
            </div>
            <span
              className="text-[11px] font-mono uppercase px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'var(--color-border, #27272a)',
                color: 'var(--color-muted, #a1a1aa)',
              }}
            >
              Step 3 of 4
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {/* RESTAURANT NAME */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                Restaurant Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3 h-4 w-4 text-amber-400 pointer-events-none" />
                <input
                  type="text"
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  placeholder="e.g. Lumina Gastro Lounge"
                  required
                  className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-amber-400 font-semibold"
                  style={inputStyle}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Restaurant Phone */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                  Restaurant Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400 pointer-events-none" />
                  <input
                    type="tel"
                    value={restaurantPhone}
                    onChange={(e) => setRestaurantPhone(e.target.value)}
                    placeholder="e.g. +1 (555) 789-0123"
                    className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Restaurant Address */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                  Restaurant Address
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3.5 top-3 h-4 w-4 text-neutral-400 pointer-events-none" />
                  <input
                    type="text"
                    value={restaurantAddress}
                    onChange={(e) => setRestaurantAddress(e.target.value)}
                    placeholder="e.g. 450 Broadway Ave"
                    className="w-full rounded-xl border pl-10 pr-4 py-2.5 text-sm outline-none transition focus:border-amber-400"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CARD 4: PLAN SELECTION                                                   */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border p-5 sm:p-6 transition-all" style={cardStyle}>
          <div className="flex items-center justify-between gap-3 mb-5 border-b pb-4" style={{ borderColor: 'var(--color-border, #27272a)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl border text-sm font-bold"
                style={{
                  backgroundColor: 'rgba(168, 85, 247, 0.1)',
                  borderColor: '#a855f7',
                  color: '#a855f7',
                }}
              >
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">
                  4. Select Your Plan
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                  Choose the dining experience you want to offer your guests
                </p>
              </div>
            </div>
            <span
              className="text-[11px] font-mono uppercase px-2.5 py-1 rounded-full border"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderColor: 'var(--color-border, #27272a)',
                color: 'var(--color-muted, #a1a1aa)',
              }}
            >
              Step 4 of 4
            </span>
          </div>

          {/* Two small plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 1. BASIC PLAN */}
            <div
              onClick={() => setPlan('basic')}
              className={`relative flex flex-col justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                plan === 'basic'
                  ? 'border-neutral-200 bg-neutral-900/90 shadow-lg'
                  : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black tracking-tight text-white">Basic</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-300 border border-neutral-700">
                      Digital Menu
                    </span>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      plan === 'basic' ? 'border-white bg-white text-black' : 'border-neutral-600'
                    }`}
                  >
                    {plan === 'basic' && <div className="h-2 w-2 rounded-full bg-black" />}
                  </div>
                </div>

                <p className="text-xs mb-4 text-neutral-400 leading-relaxed">
                  Only digital menu provided for your restaurant. Diners scan table QR codes to view dishes and prices on their mobile devices.
                </p>

                <div className="space-y-2 border-t border-neutral-800/80 pt-3 text-xs">
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
                <span className="text-xs font-semibold text-neutral-300">
                  {plan === 'basic' ? '● Selected Plan' : 'Click to select Basic'}
                </span>
              </div>
            </div>

            {/* 2. PRO PLAN */}
            <div
              onClick={() => setPlan('pro')}
              className={`relative flex flex-col justify-between p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${
                plan === 'pro'
                  ? 'border-lime-400 bg-lime-950/20 shadow-xl shadow-lime-500/10'
                  : 'border-neutral-800 bg-neutral-950/40 hover:border-neutral-700'
              }`}
            >
              {/* Highlight ribbon */}
              <div className="absolute -top-3 right-4 bg-gradient-to-r from-lime-400 to-emerald-400 text-black text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-md">
                Recommended
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black tracking-tight text-white">Pro Plan</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-lime-400/20 text-lime-400 border border-lime-400/40">
                      Menu + Ordering
                    </span>
                  </div>
                  <div
                    className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                      plan === 'pro' ? 'border-lime-400 bg-lime-400 text-black' : 'border-neutral-600'
                    }`}
                  >
                    {plan === 'pro' && <div className="h-2 w-2 rounded-full bg-black" />}
                  </div>
                </div>

                <p className="text-xs mb-4 text-neutral-300 leading-relaxed">
                  Digital menu <strong className="text-lime-400">PLUS interactive food ordering</strong>. Customers can view the menu AND place orders directly from their tables.
                </p>

                <div className="space-y-2 border-t border-neutral-800/80 pt-3 text-xs">
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
                <span className={`text-xs font-bold ${plan === 'pro' ? 'text-lime-400' : 'text-neutral-300'}`}>
                  {plan === 'pro' ? '✓ Selected Pro Plan' : 'Click to select Pro'}
                </span>
              </div>
            </div>
          </div>

          {/* Conditional Billing & Tax Configuration - ONLY appears when Pro Plan is selected */}
          <AnimatePresence>
            {plan === 'pro' && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -8 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -8 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden pt-5"
              >
                <div
                  className="rounded-2xl border p-5"
                  style={{
                    backgroundColor: 'rgba(132, 204, 22, 0.04)',
                    borderColor: 'rgba(132, 204, 22, 0.3)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Receipt className="w-4 h-4 text-lime-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-lime-400">
                      Billing & Tax Configuration (Pro Ordering Feature)
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mb-4">
                    Configure your live dining POS billing, currency, and tax rates for table orders and digital invoices.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Currency */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                        Currency
                      </label>
                      <select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-lime-400 bg-neutral-900 cursor-pointer"
                        style={inputStyle}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tax Rate */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                        Tax Rate (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={taxRate}
                          onChange={(e) => setTaxRate(e.target.value)}
                          placeholder="8.25"
                          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-lime-400"
                          style={inputStyle}
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-neutral-400 font-mono">%</span>
                      </div>
                    </div>

                    {/* Service Charge */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                        Service Charge (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={serviceCharge}
                          onChange={(e) => setServiceCharge(e.target.value)}
                          placeholder="5.00"
                          className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:border-lime-400"
                          style={inputStyle}
                        />
                        <span className="absolute right-3 top-2.5 text-xs text-neutral-400 font-mono">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="flex items-center gap-2 text-sm p-3.5 rounded-xl border"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              borderColor: 'rgba(239, 68, 68, 0.3)',
            }}
          >
            <XCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting}
          className="group relative overflow-hidden rounded-xl py-4 text-sm font-bold uppercase tracking-wider transition-all duration-200 active:scale-[0.99] disabled:opacity-50 shadow-xl"
          style={{
            backgroundColor: 'var(--color-accent, #84cc16)',
            color: '#000000',
          }}
        >
          <span className="relative z-10 flex items-center justify-center gap-2 font-black">
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                <span>Creating Account & Setting Up Restaurant…</span>
              </>
            ) : (
              <>
                <span>Complete Registration & Launch Restaurant</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </span>
        </button>
      </form>
    </AuthLayout>
  );
}