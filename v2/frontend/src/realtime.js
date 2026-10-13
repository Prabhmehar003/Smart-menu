/**
 * Real-Time Order & Customer Sync Manager
 * Multi-tier real-time communication:
 * 1. Server-Sent Events (SSE) from /api/events/orders (cross-device: phone -> laptop)
 * 2. BroadcastChannel ('smart_menu_sync') (instant zero-delay cross-tab)
 * 3. Window Storage Event (fallback for private tabs)
 */

let sseSource = null;
let broadcastChannel = null;
let isInitialized = false;

export function broadcastLocalOrder(order) {
  const payload = {
    type: 'new_order',
    order_id: order?.order_id,
    table_id: order?.table_id,
    customer_id: order?.customer_id,
    total: order?.total,
    created_at: order?.created_at || new Date().toISOString(),
    timestamp: Date.now(),
  };

  // 1. Post to BroadcastChannel for instant cross-tab delivery
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      if (!broadcastChannel) {
        broadcastChannel = new BroadcastChannel('smart_menu_sync');
      }
      broadcastChannel.postMessage(payload);
    }
  } catch {}

  // 2. Trigger localStorage change for storage event fallback
  try {
    localStorage.setItem('smart_menu_last_order_sync', JSON.stringify(payload));
  } catch {}

  // 3. Dispatch local in-window events immediately
  window.dispatchEvent(new CustomEvent('smart_menu_orders_updated', { detail: payload }));
  window.dispatchEvent(new CustomEvent('smart_menu_customers_updated', { detail: payload }));
  window.dispatchEvent(new CustomEvent('smart_menu_dashboard_updated', { detail: payload }));
}

export function initRealtime() {
  if (isInitialized && sseSource && sseSource.readyState !== EventSource.CLOSED) {
    return () => {};
  }
  isInitialized = true;

  // 1. Set up BroadcastChannel listener
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      if (!broadcastChannel) {
        broadcastChannel = new BroadcastChannel('smart_menu_sync');
      }
      broadcastChannel.onmessage = (event) => {
        const data = event.data;
        if (data && (data.type === 'new_order' || data.type === 'order_updated')) {
          window.dispatchEvent(new CustomEvent('smart_menu_orders_updated', { detail: data }));
          window.dispatchEvent(new CustomEvent('smart_menu_customers_updated', { detail: data }));
          window.dispatchEvent(new CustomEvent('smart_menu_dashboard_updated', { detail: data }));
        }
      };
    }
  } catch {}

  // 2. Set up Window Storage event listener (cross-tab fallback)
  const handleStorage = (e) => {
    if (e.key === 'smart_menu_last_order_sync' && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        window.dispatchEvent(new CustomEvent('smart_menu_orders_updated', { detail: data }));
        window.dispatchEvent(new CustomEvent('smart_menu_customers_updated', { detail: data }));
        window.dispatchEvent(new CustomEvent('smart_menu_dashboard_updated', { detail: data }));
      } catch {}
    }
  };
  window.addEventListener('storage', handleStorage);

  // 3. Set up SSE connection to backend (cross-device: phone -> dashboard)
  let reconnectTimer = null;
  const connectSSE = () => {
    try {
      if (sseSource) {
        try { sseSource.close(); } catch {}
      }
      sseSource = new EventSource('/api/events/orders');

      sseSource.onmessage = (event) => {
        if (!event.data) return;
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_order' || data.type === 'order_updated') {
            window.dispatchEvent(new CustomEvent('smart_menu_orders_updated', { detail: data }));
            window.dispatchEvent(new CustomEvent('smart_menu_customers_updated', { detail: data }));
            window.dispatchEvent(new CustomEvent('smart_menu_dashboard_updated', { detail: data }));
          }
        } catch {}
      };

      sseSource.onerror = () => {
        try { sseSource.close(); } catch {}
        if (!reconnectTimer) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connectSSE();
          }, 3000);
        }
      };
    } catch {}
  };

  connectSSE();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    window.removeEventListener('storage', handleStorage);
    if (sseSource) {
      try { sseSource.close(); } catch {}
    }
    isInitialized = false;
  };
}
