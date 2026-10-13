// src/lib/firebase.js
//
// Initializes the Firebase app once. Every other file that calls
// getAuth() (SignUp.jsx, SignIn.jsx, etc.) depends on this having run
// FIRST — that's why it's imported directly in main.jsx, before <App />
// ever renders.
//
// Get these values from:
// Firebase Console -> Project Settings -> General -> Your apps -> SDK setup and configuration

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Warn early if env vars are missing so the user knows to configure them in .env
const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  console.warn(
    `[Firebase] Missing env vars: ${missingKeys.join(', ')}. Set them in your .env file for live Firebase authentication.`
  );
}

const safeConfig = {
  apiKey: firebaseConfig.apiKey || 'AIzaSyDemoPlaceholderKeyForInitialization',
  authDomain: firebaseConfig.authDomain || 'smart-menu-demo.firebaseapp.com',
  projectId: firebaseConfig.projectId || 'smart-menu-demo',
  storageBucket: firebaseConfig.storageBucket || 'smart-menu-demo.appspot.com',
  messagingSenderId: firebaseConfig.messagingSenderId || '1234567890',
  appId: firebaseConfig.appId || '1:1234567890:web:abcdef123456',
};

// initializeApp must run FIRST — everything below depends on this
// instance existing before it's referenced.
export const firebaseApp = initializeApp(safeConfig);

// Exported so other files can just do `import { auth } from '../../lib/firebase'`
// instead of calling getAuth() themselves — guarantees they're all
// using the same initialized instance.
export const auth = getAuth(firebaseApp);

// Analytics only works in a real browser with the right conditions
// (not SSR, not blocked by an ad-blocker, not in some webviews) —
// isSupported() checks that before calling getAnalytics(), which
// throws synchronously if the environment can't support it.
// This is optional; safe to delete this whole block if you don't
// need analytics.
export let analytics = null;
isSupported()
  .then((supported) => {
    if (supported) {
      analytics = getAnalytics(firebaseApp);
    }
  })
  .catch(() => {
    // Analytics unsupported in this environment — non-fatal, ignore.
  });