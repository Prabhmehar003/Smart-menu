// ---------------------------------------------------------------------------
// Theming: two modes only — "light" and "jet" (true black, not dark-gray).
// Shared across every admin page so the sidebar, cards, and inputs never
// drift visually as new pages get added.
// ---------------------------------------------------------------------------
export const THEMES = {
  light: {
    page: 'bg-[#F4F3EF] text-[#0a0a0a]',
    sidebar: 'bg-white/70 backdrop-blur-2xl border-white/60',
    sidebarActive: 'bg-[#0a0a0a] text-white',
    sidebarInactive: 'text-[#0a0a0a]/50 hover:bg-black/5 hover:text-[#0a0a0a]',
    topbar: 'bg-white/60 backdrop-blur-2xl border-black/5',
    card: 'bg-white/70 backdrop-blur-2xl border-black/5',
    cardHover: 'hover:border-black/15 hover:bg-white/90',
    input: 'bg-white/70 border-black/10 text-[#0a0a0a] placeholder:text-black/30 focus:border-[#0a0a0a]/40 focus:bg-white',
    textPrimary: 'text-[#0a0a0a]',
    textSecondary: 'text-black/50',
    textMuted: 'text-black/30',
    accentText: 'text-[#7A8F00]',
    accentBg: 'bg-[#D6FF00]',
    accentBorder: 'border-[#7A8F00]/30',
    glow1: 'bg-[#D6FF00]/25',
    glow2: 'bg-[#00A0CF]/15',
    glow3: 'bg-[#CF00A0]/10',
    divider: 'border-black/8',
    statIconBg: 'bg-[#0a0a0a]/5',
    danger: 'text-[#D64545]',
    dangerBg: 'bg-[#D64545]/10',
    dangerBorder: 'border-[#D64545]/30',
  },
  jet: {
    page: 'bg-[#050508] text-white',
    sidebar: 'bg-white/[0.03] backdrop-blur-2xl border-white/10',
    sidebarActive: 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black',
    sidebarInactive: 'text-white/45 hover:bg-white/5 hover:text-white',
    topbar: 'bg-black/40 backdrop-blur-2xl border-white/10',
    card: 'bg-[#0a0d14]/70 backdrop-blur-2xl border-white/10',
    cardHover: 'hover:border-amber-400/40 hover:bg-white/[0.07]',
    input: 'bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-amber-400/50 focus:bg-white/[0.08]',
    textPrimary: 'text-white',
    textSecondary: 'text-white/50',
    textMuted: 'text-white/25',
    accentText: 'text-amber-400',
    accentBg: 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500',
    accentBorder: 'border-amber-400/30',
    glow1: 'bg-amber-500/10',
    glow2: 'bg-orange-500/10',
    glow3: 'bg-amber-400/8',
    divider: 'border-white/10',
    statIconBg: 'bg-white/5',
    danger: 'text-[#FF3B3B]',
    dangerBg: 'bg-[#FF3B3B]/10',
    dangerBorder: 'border-[#FF3B3B]/40',
  },
};

// The menu selection is also the live accent palette for the admin UI.
const MENU_ACCENTS = {
  'amber-gold': {
    accentText: 'text-amber-400',
    accentBg: 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500',
    accentBorder: 'border-amber-400/30',
    sidebarActive: 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.35)]',
    glow1: 'bg-amber-500/12',
    glow2: 'bg-orange-500/10',
    glow3: 'bg-amber-400/8',
  },
  'acid-lime': {
    accentText: 'text-[#D6FF00]', accentBg: 'bg-[#D6FF00]', accentBorder: 'border-[#D6FF00]/30', sidebarActive: 'bg-[#D6FF00] text-black',
    glow1: 'bg-[#D6FF00]/10', glow2: 'bg-[#8FCF00]/10', glow3: 'bg-[#D6FF00]/8',
  },
  'acid-cyan': {
    accentText: 'text-[#00F0FF]', accentBg: 'bg-[#00F0FF]', accentBorder: 'border-[#00F0FF]/30', sidebarActive: 'bg-[#00F0FF] text-black',
    glow1: 'bg-[#00F0FF]/10', glow2: 'bg-[#00A0CF]/10', glow3: 'bg-[#00F0FF]/8',
  },
  'acid-pink': {
    accentText: 'text-[#FF00FF]', accentBg: 'bg-[#FF00FF]', accentBorder: 'border-[#FF00FF]/30', sidebarActive: 'bg-[#FF00FF] text-black',
    glow1: 'bg-[#FF00FF]/10', glow2: 'bg-[#CF00A0]/10', glow3: 'bg-[#FF00FF]/8',
  },
  'bright-orange-neon': {
    accentText: 'text-[#FF6B00]', accentBg: 'bg-[#FF6B00]', accentBorder: 'border-[#FF6B00]/30', sidebarActive: 'bg-[#FF6B00] text-black',
    glow1: 'bg-[#FF6B00]/12', glow2: 'bg-[#FFB000]/10', glow3: 'bg-[#FF6B00]/8',
  },
};

export function getTheme(mode, menuTheme = 'amber-gold') {
  return { ...THEMES[mode], ...(MENU_ACCENTS[menuTheme] || MENU_ACCENTS['amber-gold']) };
}

// Status → color mapping used by the Orders kitchen queue and dashboard feed.
export const STATUS_META = {
  transmitted: { label: 'NEW', color: '#00F0FF', lightColor: '#00A0CF' },
  preparing: { label: 'PREPARING', color: '#D6FF00', lightColor: '#7A8F00' },
  ready: { label: 'READY', color: '#FF9900', lightColor: '#B36B00' },
  served: { label: 'SERVED', color: '#8FFF8F', lightColor: '#3F8F3F' },
  cancelled: { label: 'CANCELLED', color: '#FF3B3B', lightColor: '#D64545' },
};

export const ORDER_STATUS_FLOW = ['transmitted', 'preparing', 'ready', 'served'];
