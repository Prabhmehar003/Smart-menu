import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UserPlus, AlertCircle, X, ArrowRight } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
} from 'firebase/auth';

import { auth } from '../../lib/firebase';
import AuthLayout, { Field } from '../../layouts/AuthLayout';

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
    ? "https://smart-menu-yf6f.onrender.com"
    : "");
const googleProvider = new GoogleAuthProvider();

export default function Login() {
  const navigate = useNavigate();

  // Form values - always blank by default
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Clear any previously remembered email so fields stay empty
  useEffect(() => {
    try {
      localStorage.removeItem('smart_menu_remembered_email');
    } catch (_) {}
  }, []);

  // UI states
  const [error, setError] = useState('');
  const [message, setMessage] = useState(''); // For password reset success msg
  const [submitting, setSubmitting] = useState(false);

  // New account prompt modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);

  /**
   * After Firebase authenticates the user, send the Firebase
   * ID token to our backend with mode: 'signin' to verify existence.
   */
  async function createBackendSession(firebaseUser) {
    const idToken = await firebaseUser.getIdToken();

    const response = await fetch(`${API_BASE}/api/auth/session`, {
      method: 'POST',
      credentials: 'include', // Required because our backend authentication uses cookies.
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idToken,
        mode: 'signin',
        deviceType: 'web',
        deviceName: navigator.userAgent,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || data.detail || 'Could not verify login session.');
    }

    if (data.userExists === false) {
      return { userExists: false, googleUser: data.googleUser };
    }

    if (data.user) {
      localStorage.setItem('acid_session', JSON.stringify(data.user));
      if (data.user.restaurant_name) {
        localStorage.setItem(
          'smart_menu_restaurant_setup',
          JSON.stringify({
            restaurant_name: data.user.restaurant_name,
            phone: data.user.restaurant_phone,
            address: data.user.restaurant_address,
            currency: data.user.currency || 'USD',
            tax_rate: data.user.tax_rate ?? 0,
            service_charge: data.user.service_charge ?? 0,
            plan: data.user.plan || 'basic',
          })
        );
      }
    }

    return { userExists: true, user: data.user };
  }

  /**
   * Navigate directly to dashboard page after sign in
   */
  const handleRedirection = () => {
    navigate('/admin');
  };

  /**
   * Email/password login
   */
  async function handleSubmit(event) {
    event.preventDefault();

    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      // STEP 1: Firebase verifies the email and password.
      const credential = await signInWithEmailAndPassword(auth, email, password);

      // STEP 2: Verify user existence in our database.
      const sessionResult = await createBackendSession(credential.user);

      if (!sessionResult.userExists) {
        setPendingGoogleUser({
          email: credential.user.email,
          name: credential.user.displayName || '',
          avatarUrl: credential.user.photoURL || '',
        });
        setShowCreateModal(true);
        return;
      }

      // STEP 3: Route directly to Dashboard
      handleRedirection();
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is disabled in your Firebase Console. Please enable "Email/Password" under Authentication > Sign-in method in Firebase Console.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password. If you originally signed up with Google, please use "Continue with Google" or click "Forgot password?".');
      } else if (err.code === 'auth/wrong-password') {
        setError('Incorrect password. Please try again or use "Forgot password?".');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later or reset your password.');
      } else {
        setError(err.message || 'Unable to sign in.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Google login
   */
  async function handleGoogleLogin() {
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      // STEP 1: Authenticate through Google/Firebase.
      const result = await signInWithPopup(auth, googleProvider);

      // STEP 2: Verify if user has already created an account in our system.
      const sessionResult = await createBackendSession(result.user);

      if (!sessionResult.userExists) {
        // User has not created an account yet! Show prompt modal to create account
        setPendingGoogleUser({
          email: result.user.email,
          name: result.user.displayName || '',
          avatarUrl: result.user.photoURL || '',
        });

        // IMPORTANT: Because Firebase creates an Auth record the instant signInWithPopup succeeds,
        // we must immediately delete this unconfirmed user from Firebase Authentication so they
        // do NOT linger as a "Signed In" registered user in Firebase Console!
        try {
          await result.user.delete();
        } catch (delErr) {
          console.warn('Could not delete unconfirmed Google user from Firebase:', delErr);
          try {
            await auth.signOut();
          } catch (_) {}
        }

        setShowCreateModal(true);
        return;
      }

      // STEP 3: User exists -> Route directly to Dashboard (/admin)
      handleRedirection();
    } catch (err) {
      console.error('Google login error:', err);
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * Forgot Password - Triggers Firebase Reset Email
   */
  async function handleForgotPassword(event) {
    event.preventDefault();
    setError('');
    setMessage('');

    const cleanEmail = email ? email.trim() : '';
    if (!cleanEmail) {
      setError('Please enter your email address in the field above to reset your password.');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      setMessage(`Password reset email sent to ${cleanEmail}! Please check your Inbox and Spam/Junk folder.`);
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email. Please check your spelling or click "Create account" below.');
      } else if (err.code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password provider is disabled in Firebase Console. Please enable "Email/Password" under Authentication > Sign-in method.');
      } else {
        setError(err.message || 'Failed to send password reset email.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const accentButtonStyle = {
    backgroundColor: 'var(--color-accent)',
    color: 'var(--color-on-accent, var(--color-bg))',
  };

  const outlineButtonStyle = {
    backgroundColor: 'transparent',
    borderColor: 'var(--color-border)',
    color: 'var(--color-fg)',
  };

  const handleCancelModal = async () => {
    setShowCreateModal(false);
    setPendingGoogleUser(null);
    try {
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }
    } catch (_) {}
    try {
      await auth.signOut();
    } catch (_) {}
  };

  const handleProceedToSignUp = async () => {
    setShowCreateModal(false);
    setPendingGoogleUser(null);
    try {
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }
    } catch (_) {}
    try {
      await auth.signOut();
    } catch (_) {}
    navigate('/signup');
  };

  return (
    <>
      <AuthLayout
        title="Welcome back"
        subtitle="Sign in to continue to Smart Menu"
        footer={
          <span>
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="font-medium hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              Create account
            </Link>
          </span>
        }
      >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Email */}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@restaurant.com"
          autoComplete="off"
          required
        />

        {/* Password */}
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />

        {/* Forgot password Button */}
        <div className="flex justify-end -mt-2">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm font-medium transition-colors hover:underline"
            style={{ color: 'var(--color-muted)' }}
          >
            Forgot password?
          </button>
        </div>

        {/* Success message (e.g. Password Reset) */}
        {message && (
          <p
            className="text-sm p-3 rounded-lg border"
            style={{
              backgroundColor: 'var(--color-success-soft, #e6ffed)',
              color: 'var(--color-success, #008000)',
              borderColor: 'var(--color-success, #008000)'
            }}
          >
            {message}
          </p>
        )}

        {/* Error message */}
        {error && (
          <p
            className="text-sm p-3 rounded-lg border"
            style={{
              backgroundColor: 'var(--color-error-soft, #ffe6e6)',
              color: 'var(--color-error, #d00000)',
              borderColor: 'var(--color-error, #d00000)'
            }}
          >
            {error}
          </p>
        )}

        {/* Login button */}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-xl py-3.5 text-sm font-bold uppercase tracking-wide transition-transform duration-150 active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100"
          style={accentButtonStyle}
        >
          {submitting ? 'Processing…' : 'Sign in'}
        </button>

        {/* OR divider */}
        <div className="flex items-center gap-3">
          <div
            className="h-px flex-1"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
          <span
            className="text-xs uppercase"
            style={{ color: 'var(--color-muted)' }}
          >
            or
          </span>
          <div
            className="h-px flex-1"
            style={{ backgroundColor: 'var(--color-border)' }}
          />
        </div>

        {/* Google Login */}
        <button
          type="button"
          disabled={submitting}
          onClick={handleGoogleLogin}
          className="rounded-xl border py-3 text-sm font-medium transition disabled:opacity-50"
          style={outlineButtonStyle}
        >
          Continue with Google
        </button>
      </form>
    </AuthLayout>

    {/* Account Not Found Modal */}
    <AnimatePresence>
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-md rounded-2xl border p-6 shadow-2xl"
            style={{
              backgroundColor: 'var(--color-surface, #18181b)',
              borderColor: 'var(--color-border, #27272a)',
              color: 'var(--color-fg, #ffffff)',
            }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={handleCancelModal}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-neutral-400 hover:text-white hover:bg-white/10 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              {/* Icon */}
              <div
                className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border"
                style={{
                  backgroundColor: 'rgba(217, 249, 157, 0.1)',
                  borderColor: 'var(--color-accent, #84cc16)',
                  color: 'var(--color-accent, #84cc16)',
                }}
              >
                <UserPlus className="h-7 w-7" />
              </div>

              <h3 className="text-xl font-bold tracking-tight mb-1.5">
                Account Not Found
              </h3>
              <p className="text-sm mb-5" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                We couldn't find an existing Smart Menu account for this Google login. Please create your account to proceed.
              </p>

              {/* Google User Profile Card */}
              {pendingGoogleUser && (
                <div
                  className="flex items-center gap-3 w-full p-3.5 mb-6 rounded-xl border text-left"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    borderColor: 'var(--color-border, #27272a)',
                  }}
                >
                  {pendingGoogleUser.avatarUrl ? (
                    <img
                      src={pendingGoogleUser.avatarUrl}
                      alt="Profile"
                      className="h-10 w-10 rounded-full border border-neutral-700 object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold">
                      {(pendingGoogleUser.name?.[0] || pendingGoogleUser.email?.[0] || 'U').toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {pendingGoogleUser.name || 'Google User'}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--color-muted, #a1a1aa)' }}>
                      {pendingGoogleUser.email}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  type="button"
                  onClick={handleCancelModal}
                  className="flex-1 rounded-xl border py-3 text-sm font-medium transition order-2 sm:order-1"
                  style={outlineButtonStyle}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProceedToSignUp}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold uppercase tracking-wide transition-transform active:scale-[0.98] order-1 sm:order-2"
                  style={accentButtonStyle}
                >
                  <span>Create account</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  </>
  );
}