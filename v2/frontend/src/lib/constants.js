export const ANIMATION_EASING = [0.16, 1, 0.3, 1];

export const HERO_COPY = {
  brand: 'SMART MENU',
  headlineLine1: 'YOUR RESTAURANT.',
  headlineLine2: 'REIMAGINED.',
  subtext: 'Create a smarter digital menu experience that evolves with your restaurant. Dynamic items, instant QR access, and effortless order flow.',
  primaryCTA: 'Build Your Menu',
  secondaryCTA: 'See How It Works',
};

export const MENU_ITEMS = [
  {
    id: '1',
    name: 'Truffle Tagliolini',
    category: 'Pasta',
    price: '$24.50',
    description: 'Handcrafted pasta, black winter truffle, Parmigiano Reggiano 24-mo, cultured butter.',
    badge: "Chef's Special",
    tag: 'Vegetarian',
    calories: '620 kcal',
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=600&q=80',
    rating: '4.9',
  },
  {
    id: '2',
    name: 'Wagyu Ribeye Steak',
    category: 'Mains',
    price: '$48.00',
    description: 'A5 Miyazaki Wagyu, smoked bone marrow jus, roasted heirloom carrots.',
    badge: 'Popular',
    tag: 'Gluten-Free',
    calories: '850 kcal',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
    rating: '5.0',
  },
  {
    id: '3',
    name: 'Artisan Burrata',
    category: 'Starters',
    price: '$18.90',
    description: 'Puglia burrata, roasted figs, aged balsamic glaze, toasted sourdough.',
    badge: "Fresh Today",
    tag: 'Organic',
    calories: '420 kcal',
    image: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb19655?auto=format&fit=crop&w=600&q=80',
    rating: '4.8',
  },
];

export const PROBLEM_POINTS = [
  {
    icon: 'Printer',
    title: 'Costly Reprinting',
    description: 'Traditional paper menus cost thousands annually to reprint whenever prices, vintages, or seasonal ingredients change.',
  },
  {
    icon: 'AlertTriangle',
    title: 'Static & Unadaptable',
    description: 'Paper menus cannot display 86’d items instantly, causing customer disappointment and service friction.',
  },
  {
    icon: 'Globe',
    title: 'Language & Dietary Barriers',
    description: 'Foreign guests and diners with strict allergies struggle with text-only paper menus without photos or live translation.',
  },
];

export const SHOWCASE_FEATURES = [
  {
    id: 'instant-qr',
    number: '01',
    cardTitle: '01 — INSTANT TABLE QR GENERATION',
    cardDescription:
      'Generate unique QR codes for every table instantly, giving guests direct access to your digital menu the moment they sit down.',
    icon: 'QrCode',
    microLabel: 'TABLE ACCESS • INSTANT',
    title: 'Instant Table QR Generation',
    description:
      'Create unique QR codes for every restaurant table instantly. Guests scan once and enter their personalized digital dining experience.',
    stat1Label: 'QR GENERATION',
    stat1Value: '< 1 SEC',
    stat2Label: 'TABLE ACCESS',
    stat2Value: 'INSTANT',
    bottomStatus: 'TABLE QR SYSTEM ACTIVE',
  },
  {
    id: 'menu-to-qr',
    number: '02',
    cardTitle: '02 — MENU-TO-QR IN SECONDS',
    cardDescription:
      'Upload your restaurant menu and transform it into a ready-to-use digital QR menu in seconds.',
    icon: 'FileUp',
    microLabel: 'MENU ENGINE • READY',
    title: 'Menu-to-QR in Seconds',
    description:
      'Upload your existing restaurant menu and instantly transform it into a digital QR experience without manually rebuilding every item.',
    stat1Label: 'PROCESSING',
    stat1Value: 'INSTANT',
    stat2Label: 'OUTPUT',
    stat2Value: 'QR READY',
    bottomStatus: 'DIGITAL MENU GENERATED',
  },
  {
    id: 'order-direct',
    number: '03',
    cardTitle: '03 — ORDER DIRECTLY FROM THE MENU',
    cardDescription:
      'Let guests browse dishes, customize their choices, and place orders directly from the digital menu.',
    icon: 'UtensilsCrossed',
    microLabel: 'ORDER FLOW • LIVE',
    title: 'Order Directly From the Menu',
    description:
      'Guests can explore the menu, customize dishes, and place orders directly from their table without waiting for manual order taking.',
    stat1Label: 'ORDER FLOW',
    stat1Value: 'DIRECT',
    stat2Label: 'GUEST ACTION',
    stat2Value: 'SCAN → ORDER',
    bottomStatus: 'LIVE ORDER RECEIVED',
  },
  {
    id: 'parallel-billing',
    number: '04',
    cardTitle: '04 — PARALLEL BILL GENERATION',
    cardDescription:
      'Generate and manage bills alongside incoming orders for a faster, smoother restaurant workflow.',
    icon: 'Receipt',
    microLabel: 'BILLING ENGINE • LIVE',
    title: 'Parallel Bill Generation',
    description:
      'Orders and billing work together in parallel, helping restaurants prepare accurate bills while the dining experience is still in progress.',
    stat1Label: 'ORDER STATUS',
    stat1Value: 'LIVE',
    stat2Label: 'BILL STATUS',
    stat2Value: 'AUTO SYNC',
    bottomStatus: 'BILLING SYSTEM ACTIVE',
  },
];

export const HOW_IT_WORKS_STEPS = [
  {
    step: '01',
    title: 'Setup Restaurant Profile',
    desc: 'Enter your restaurant details, upload brand logo, and select your custom typography & color palette.',
  },
  {
    step: '02',
    title: 'Curate Digital Menu',
    desc: 'Add dishes, categories, high-res photography, allergen tags, and wine pairings in our intuitive dashboard.',
  },
  {
    step: '03',
    title: 'Deploy Table QR Codes',
    desc: 'Generate elegant, brand-customized QR table standees or NFC discs linked directly to your live menu.',
  },
  {
    step: '04',
    title: 'Instant Guest Dining',
    desc: 'Guests scan with their phone camera—no app download required—browse, customize, and order effortlessly.',
  },
];

export const METRICS = [
  { value: '+32%', label: 'Avg Order Value' },
  { value: '-40%', label: 'Waiter Order Time' },
  { value: '100%', label: 'Instant Updates' },
  { value: '4.9/5', label: 'Guest Rating' },
];

export const PRICING_PLANS = [
  {
    name: 'Bistro',
    priceMonthly: '$49',
    priceAnnual: '$39',
    description: 'Perfect for boutique cafes & single-location bistros looking for instant digital menus.',
    features: [
      'Up to 50 Menu Items',
      'Instant Price & Stock Updates',
      'Custom QR Code Generator',
      'Mobile-Optimized Guest View',
      'Email Support',
    ],
    cta: 'Start Bistro Trial',
    popular: false,
  },
  {
    name: 'Brasserie',
    priceMonthly: '$99',
    priceAnnual: '$79',
    description: 'Designed for high-volume dining, multi-room venues & fine-dining establishments.',
    features: [
      'Unlimited Menu Items',
      'Auto 12-Language AI Translation',
      'Smart Allergen Filtering',
      'High-Resolution Dish Photos & 3D Cards',
      'Live POS Integration',
      'Priority 24/7 Concierge Support',
    ],
    cta: 'Build Your Menu',
    popular: true,
  },
  {
    name: 'Enterprise',
    priceMonthly: 'Custom',
    priceAnnual: 'Custom',
    description: 'Tailored solutions for restaurant groups, hotel chains, and multi-location franchises.',
    features: [
      'Multi-Location Dashboard',
      'Custom Domain & Whitelabeling',
      'Dedicated Account Manager',
      'Custom POS & Kitchen Display API',
      'SLA & 99.99% Uptime Guarantee',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
];
