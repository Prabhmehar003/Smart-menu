// src/layouts/AuthLayout.jsx
//
// Shared blueprint/shell for login + signup pages. Pure token-driven
// styling — every color comes from the CSS vars defined in your global
// stylesheet (--color-bg, --color-fg, --color-accent, --color-surface,
// --color-border, --color-muted). No hardcoded Tailwind neutral/gray
// classes, so light mode (white/black/lime) and .dark (jet black/lime)
// both work automatically off whatever <html> class is active.
//
// UX/UI pass: same components, same props, same logic — only the
// visual language changed. Leaning into the hard black/white/lime
// palette with a sharper, editorial feel: thicker borders, a real
// section-progress rail instead of a plain accordion list, staggered
// entrance motion, and a more deliberate focus/hover language.

import { useState, useRef, useId } from 'react';

// -------------------------------------------------------------------
// Avatar uploader: file picker -> POST /api/auth/avatar (multipart).
// If the user came in via Google, `initialUrl` is already Firebase's
// picture URL — this just lets them replace it.
// -------------------------------------------------------------------
export function AvatarUploader({ initialUrl, onUploaded, apiBase }) {
  const [preview, setPreview] = useState(initialUrl || null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  async function uploadFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }

    setError(null);
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch(`${apiBase}/api/auth/avatar`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || 'Upload failed.');
      }

      const data = await res.json();
      setPreview(data.avatarUrl);
      onUploaded?.(data.avatarUrl);
    } catch (err) {
      setError(err.message || 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          uploadFile(e.dataTransfer.files?.[0]);
        }}
        className="group relative h-28 w-28 overflow-hidden rounded-full border-2 transition-all duration-200"
        style={{
          borderStyle: preview ? 'solid' : 'dashed',
          borderColor: dragOver ? 'var(--color-accent)' : 'var(--color-border)',
          backgroundColor: 'var(--color-surface)',
          transform: dragOver ? 'scale(1.04)' : 'scale(1)',
        }}
      >
        {preview ? (
          <img src={preview} alt="Avatar preview" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-center" style={{ color: 'var(--color-muted)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M12 16V4M12 4L7 9M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[10px] font-medium uppercase tracking-wide">Upload</span>
          </span>
        )}

        {/* hover scrim on filled state */}
        {preview && !uploading && (
          <span
            className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-wide opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#FFFFFF' }}
          >
            Replace
          </span>
        )}

        {uploading && (
          <span
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          >
            <span
              className="h-5 w-5 animate-spin rounded-full border-2"
              style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'var(--color-accent)' }}
            />
          </span>
        )}

        {/* accent ping when a photo lands, purely decorative */}
        {preview && !uploading && (
          <span
            className="pointer-events-none absolute -right-0.5 -top-0.5 h-4 w-4 rounded-full border-2"
            style={{ backgroundColor: 'var(--color-accent)', borderColor: 'var(--color-bg)' }}
          />
        )}
      </button>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => uploadFile(e.target.files?.[0])} />
      <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
        {preview ? 'Click or drop to replace' : 'Drag & drop, or click — optional'}
      </p>
      {error && <p className="text-xs font-medium" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  );
}

// -------------------------------------------------------------------
// Shared field primitive — token-driven border/bg/focus ring (accent).
// Label lifts and the accent underline draws in on focus.
// -------------------------------------------------------------------
export function Field({ label, value, onChange, type = 'text', textarea = false, hint, required, ...rest }) {
  const [focused, setFocused] = useState(false);
  const reactId = useId();
  const hasValue = value !== undefined && value !== null && value !== '';

  const style = {
    backgroundColor: 'var(--color-bg)',
    color: 'var(--color-fg)',
    borderColor: focused ? 'var(--color-accent)' : 'var(--color-border)',
  };

  const shared = 'peer w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none transition-colors duration-150';

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={reactId} className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide" style={{ color: focused ? 'var(--color-fg)' : 'var(--color-muted)' }}>
        {label}
        {required && <span style={{ color: 'var(--color-accent)' }}>*</span>}
      </label>
      <div className="relative">
        {textarea ? (
          <textarea
            id={reactId}
            rows={3}
            value={value ?? ''}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={shared}
            style={style}
            required={required}
            {...rest}
          />
        ) : (
          <input
            id={reactId}
            type={type}
            value={value ?? ''}
            onChange={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            className={shared}
            style={style}
            required={required}
            {...rest}
          />
        )}
        {/* animated accent underline, independent of the border color change */}
        <span
          className="pointer-events-none absolute bottom-0 left-0 h-[2px] transition-all duration-200 ease-out"
          style={{ width: focused ? '100%' : '0%', backgroundColor: 'var(--color-accent)' }}
        />
      </div>
      {hint && <span className="text-[11px]" style={{ color: 'var(--color-muted)' }}>{hint}</span>}
    </div>
  );
}

// -------------------------------------------------------------------
// Contact / location — maps to users table columns, same for both roles.
// -------------------------------------------------------------------
export function ContactLocationFields({ values, onChange }) {
  const set = (key) => (e) => onChange({ ...values, [key]: e.target.value });

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
      <Field label="Phone number" value={values.phoneNumber} onChange={set('phoneNumber')} type="tel" />
      <Field label="Address line" value={values.addressLine} onChange={set('addressLine')} />
      <Field label="City" value={values.city} onChange={set('city')} />
      <Field label="Region / State" value={values.region} onChange={set('region')} />
      <Field label="Country code" value={values.country} onChange={set('country')} maxLength={2} hint="e.g. NZ" />
      <Field label="Postal code" value={values.postalCode} onChange={set('postalCode')} />
    </div>
  );
}

// -------------------------------------------------------------------
// Provider-only — maps to provider_profiles.
// -------------------------------------------------------------------
export function ProviderFields({ values, onChange }) {
  const set = (key) => (e) => onChange({ ...values, [key]: e.target.value });

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
      <Field label="Business name" value={values.businessName} onChange={set('businessName')} />
      <Field label="Years of experience" value={values.yearsExperience} onChange={set('yearsExperience')} type="number" min="0" />
      <Field label="Hourly rate (NZD)" value={values.hourlyRate} onChange={set('hourlyRate')} type="number" step="0.01" min="0" />
      <Field label="Service radius (km)" value={values.serviceRadiusKm} onChange={set('serviceRadiusKm')} type="number" min="0" hint="Default 25km" />
      <Field label="License number" value={values.licenseNumber} onChange={set('licenseNumber')} hint="Optional" />
      <div className="sm:col-span-2">
        <Field label="Bio" value={values.bio} onChange={set('bio')} textarea hint="A short intro clients will see" />
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// Client-only — maps to nothing extra beyond users (schema has no
// client-specific table), but this is where a preferences-style field
// would live if you add one later. Kept as an explicit component so
// SignUp.jsx has a symmetrical role branch rather than an empty gap.
// -------------------------------------------------------------------
export function ClientFields() {
  return null;
}

// -------------------------------------------------------------------
// Collapsible section wrapper. Now numbered, with a filled/outline
// index badge that reflects open state, and a smooth height reveal
// instead of an instant show/hide.
// -------------------------------------------------------------------
export function Section({ index, title, description, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="overflow-hidden rounded-xl border transition-colors duration-200"
      style={{ borderColor: open ? 'var(--color-fg)' : 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3.5 px-5 py-4 text-left"
      >
        {index != null && (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors duration-200"
            style={
              open
                ? { backgroundColor: 'var(--color-accent)', color: '#000000' }
                : { border: '1px solid var(--color-border)', color: 'var(--color-muted)' }
            }
          >
            {index}
          </span>
        )}
        <div className="flex-1">
          <div className="text-sm font-semibold" style={{ color: 'var(--color-fg)' }}>{title}</div>
          {description && (
            <div className="mt-0.5 text-xs" style={{ color: 'var(--color-muted)' }}>{description}</div>
          )}
        </div>
        <span
          className="text-xl leading-none transition-transform duration-200"
          style={{ color: 'var(--color-accent)', transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}
        >
          +
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div
            className="px-5 pb-5 pt-1"
            style={{ borderTop: '1px solid var(--color-border)', marginTop: '0.25rem', paddingTop: '1.25rem' }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------------
// The layout shell — branding rail + card, all token-driven.
// Adds a subtle grain/grid texture on the rail and a staggered
// fade/rise entrance on the form card.
// -------------------------------------------------------------------
export default function AuthLayout({ title, subtitle, children, footer, maxWidth = 'max-w-xl' }) {
  return (
    <div className="flex min-h-screen w-full" style={{ backgroundColor: 'var(--color-bg)' }}>
      <style>{`
        @keyframes authRise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .auth-rise { animation: authRise 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
      `}</style>

      <div
        className="relative hidden flex-1 flex-col justify-between overflow-hidden p-12 lg:flex"
        style={{ backgroundColor: 'var(--color-fg)', color: 'var(--color-bg)' }}
      >
        {/* faint grid texture, purely decorative */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, var(--color-bg) 1px, transparent 1px), linear-gradient(to bottom, var(--color-bg) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* accent glow, bottom-left */}
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: 'var(--color-accent)' }}
        />

        <div className="relative flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: 'var(--color-accent)' }} />
          SMART MENU
        </div>
        <div className="relative max-w-sm text-3xl font-medium leading-[1.15] tracking-tight">
          Next-Gen Dining OS — Elevate dining experiences and streamline restaurant operations.
        </div>
        <div className="relative text-xs" style={{ opacity: 0.5 }}>© {new Date().getFullYear()} Smart Menu</div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 sm:px-6 py-12">
        <div className={`w-full ${maxWidth}`}>
          <div className="auth-rise mb-6 text-center" style={{ animationDelay: '0ms' }}>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--color-fg)' }}>{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm" style={{ color: 'var(--color-muted)' }}>{subtitle}</p>}
          </div>

          <div
            className="auth-rise w-full rounded-2xl border p-6 sm:p-8"
            style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)', animationDelay: '80ms' }}
          >
            {children}
          </div>

          {footer && (
            <div className="auth-rise mt-6 text-center text-sm" style={{ color: 'var(--color-muted)', animationDelay: '160ms' }}>
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}