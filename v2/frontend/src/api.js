// api.js
// Thin fetch wrapper — every admin page and the customer app hit real
// endpoints through this module.  Throws on non-2xx so callers can catch
// and surface a real error state instead of silently swallowing failures.

const defaultBaseUrl =
  typeof window !== "undefined" &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1"
    ? "https://smart-menu-yf6f.onrender.com"
    : "";

const API_ROOT = import.meta.env.VITE_API_BASE_URL || defaultBaseUrl;
const BASE = API_ROOT ? `${API_ROOT}/api` : "/api";

const inflightRequests = new Map();
const recentGetCache = new Map();

export async function getAuthToken() {
  let token = typeof localStorage !== "undefined" ? localStorage.getItem("acid_token") : null;
  if (!token && typeof localStorage !== "undefined") {
    try {
      const sess = JSON.parse(localStorage.getItem("acid_session") || "{}");
      if (sess?.token) token = sess.token;
    } catch (_) {}
  }
  if (!token && typeof window !== "undefined") {
    try {
      const { auth } = await import("./lib/firebase");
      if (auth?.currentUser) {
        token = await auth.currentUser.getIdToken();
      }
    } catch (_) {}
  }
  return token;
}

/**
 * Core fetch helper with in-flight deduplication and short TTL caching for GETs.
 * @param {string} path      - Path relative to BASE (e.g. '/orders')
 * @param {RequestInit} opts - Standard fetch options
 * @returns {Promise<any>}   - Parsed JSON body
 * @throws  {Error}          - err.message = server detail; err.status = HTTP code
 */
async function request(path, opts = {}) {
  const method = (opts.method || "GET").toUpperCase();
  const url = `${BASE}${path}`;

  // For GET requests, serve from very recent cache (2.5s) or deduplicate in-flight
  if (method === "GET") {
    const cached = recentGetCache.get(url);
    if (cached && Date.now() - cached.timestamp < 2500) {
      return cached.data;
    }
    if (inflightRequests.has(url)) {
      return inflightRequests.get(url);
    }
  } else {
    // Invalidate GET cache on any mutation
    recentGetCache.clear();
  }

  const fetchPromise = (async () => {
    try {
      const token = await getAuthToken();
      const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(url, {
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders, ...opts.headers },
        ...opts,
      });

      let data = null;
      try {
        data = await res.json();
      } catch {
        // Some endpoints return an empty body (e.g. 204 No Content) — that's fine.
      }

      if (!res.ok) {
        const message = data?.detail || `Request failed (${res.status})`;
        const err = new Error(message);
        err.status = res.status;
        throw err;
      }

      if (method === "GET" && data) {
        recentGetCache.set(url, { data, timestamp: Date.now() });
      }

      return data;
    } finally {
      if (method === "GET") {
        inflightRequests.delete(url);
      }
    }
  })();

  if (method === "GET") {
    inflightRequests.set(url, fetchPromise);
  }

  return fetchPromise;
}

export const api = {
  // ── Auth & Profile ───────────────────────────────────────────────────
  getMe: () => request("/auth/me"),
  updateProfile: (payload) =>
    request("/auth/complete-profile", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () => request("/auth/logout", { method: "POST" }),

  // ── Dashboard ────────────────────────────────────────────────────────
  getDashboard: () => request("/dashboard"),

  // ── Settings ─────────────────────────────────────────────────────────
  getSettings: () => request("/settings"),

  updateSettings: (payload) =>
    request("/settings", {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  // ── Tables ───────────────────────────────────────────────────────────

  /**
   * Return the persisted table rows (token + table_id) for the most-recently
   * uploaded menu so TablesPage can reconstruct QR cards after a page refresh
   * without requiring a fresh upload.
   */
  getTablesCurrent: () => request("/tables/current"),

  /**
   * Regenerate all JWT tokens for the latest menu, invalidating any
   * already-printed QR codes.
   */
  resetTables: () => request("/tables/reset", { method: "POST" }),

  // ── Orders (admin) ───────────────────────────────────────────────────

  /**
   * List orders with optional filters.
   * @param {{ status?: string, table_id?: string, menu_id?: string }} params
   */
  getOrders: (params = {}) => {
    // Strip undefined / null / empty-string values so they don't appear in QS.
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v != null && v !== "")
    );
    const qs = new URLSearchParams(clean).toString();
    return request(`/orders${qs ? `?${qs}` : ""}`);
  },

  updateOrderStatus: (orderId, status) =>
    request(`/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // ── Orders (customer — session-scoped) ───────────────────────────────

  /**
   * Fetch a single order for the customer tracking screen.
   * The backend validates that the session_token belongs to the same
   * table the order was placed from, so guests can't peek at other tables.
   *
   * @param {string} orderId
   * @param {string} sessionToken  - The session_token returned by /api/order
   */
  getOrderForCustomer: (orderId, sessionToken) =>
    request(
      `/orders/${encodeURIComponent(orderId)}?session_token=${encodeURIComponent(sessionToken)}`
    ),

  /**
   * Fetch all orders placed for the active table session.
   * Enables customers to see their ordered food if they return to the menu or refresh.
   */
  getSessionOrders: (sessionToken) =>
    request(`/session/orders?session_token=${encodeURIComponent(sessionToken)}`),

  // ── Customers ────────────────────────────────────────────────────────
  getCustomers: () => request("/customers"),

  getCustomerOrders: (customerId) =>
    request(`/customers/${customerId}/orders`),

  // ── Dynamic Tables & Proxy ───────────────────────────────────────────
  renameTable: (tableId, newName, menuId = null) =>
    request(`/tables/${encodeURIComponent(tableId)}/rename`, {
      method: "PATCH",
      body: JSON.stringify({ new_name: newName, menu_id: menuId }),
    }),

  resolveTableProxy: (payload) =>
    request("/t/resolve", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ── Menu Upload & AI Processing ─────────────────────────────────────
  processMenu: async (formData) => {
    let token = await getAuthToken();
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

    const endpoints = [
      `${BASE}/process-menu`,
      ...(BASE !== "/api" ? ["/api/process-menu"] : []),
    ];

    let lastError = null;
    for (const targetUrl of endpoints) {
      try {
        const res = await fetch(targetUrl, {
          method: "POST",
          body: formData,
          credentials: "include",
          headers: {
            ...authHeaders,
          },
        });

        // If 401, try to refresh token via Firebase if available and retry once
        if (res.status === 401 && typeof window !== "undefined") {
          try {
            const { auth } = await import("./lib/firebase");
            if (auth?.currentUser) {
              const freshIdToken = await auth.currentUser.getIdToken(true);
              const sessionRes = await fetch(`${BASE}/auth/session`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  idToken: freshIdToken,
                  mode: "signin",
                  deviceType: "web",
                  deviceName: navigator.userAgent,
                }),
              });
              if (sessionRes.ok) {
                const sessionData = await sessionRes.json();
                if (sessionData.token) {
                  localStorage.setItem("acid_token", sessionData.token);
                  const retryRes = await fetch(targetUrl, {
                    method: "POST",
                    body: formData,
                    credentials: "include",
                    headers: {
                      Authorization: `Bearer ${sessionData.token}`,
                    },
                  });
                  return retryRes;
                }
              }
            }
          } catch (refreshErr) {
            console.warn("Token refresh attempt failed:", refreshErr);
          }
        }

        return res;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error("Could not reach the server.");
  },
};