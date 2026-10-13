import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  Clock,
  ArrowRight,
  ChevronRight,
  Utensils,
  CheckCircle2,
  Receipt,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import { STATUS_META } from '../theme';

const STATUS_DISPLAY_NAMES = {
  transmitted: 'Pending',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Completed',
  cancelled: 'Cancelled',
};

function parseOrderDate(dateInput) {
  if (!dateInput) return null;
  let d = new Date(dateInput);
  if (isNaN(d.getTime())) {
    const str = String(dateInput).trim().replace(' ', 'T');
    d = new Date(str.endsWith('Z') ? str : str + 'Z');
  }
  return isNaN(d.getTime()) ? null : d;
}

function timeAgo(dateInput) {
  const d = parseOrderDate(dateInput);
  if (!d) return 'just now';
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return 'just now';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationsModal({
  isOpen,
  onClose,
  orders = [],
  onOrderClick,
  onViewAllOrders,
}) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleCardClick = (orderId) => {
    if (onOrderClick) {
      onOrderClick(orderId);
    }
    onClose();
  };

  const handleAllClick = () => {
    if (onViewAllOrders) {
      onViewAllOrders();
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop with rich blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-md cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="relative w-full max-w-xl rounded-[28px] bg-[#0c0e14]/95 border border-white/15 p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.85),0_0_40px_rgba(245,158,11,0.08)] backdrop-blur-2xl z-10 my-auto overflow-hidden flex flex-col max-h-[88vh]"
          >
            {/* Top Amber Ambient Glow */}
            <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-amber-500/20 blur-3xl rounded-full" />

            {/* Header */}
            <div className="flex items-center justify-between pb-5 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-400/10 border border-amber-400/25 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                  <Bell size={18} className="animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                      Active Orders
                    </h2>
                    {orders.length > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FF3B3B]/15 text-[#FF5A5A] border border-[#FF3B3B]/30 shadow-[0_0_10px_rgba(255,59,59,0.2)]">
                        {orders.length} Incomplete
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        0 Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Click any order to view and manage in the Orders page
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:border-white/20 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer active:scale-90"
              >
                <X size={15} />
              </button>
            </div>

            {/* Scrollable Order List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3 min-h-0 pr-1">
              {orders.length === 0 ? (
                /* Empty state */
                <div className="py-12 px-4 text-center flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                    <CheckCircle2 size={26} />
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">
                    All caught up!
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-xs mb-5">
                    There are no incomplete orders right now. The red notification dot will automatically light up when a new order is received.
                  </p>
                  <button
                    type="button"
                    onClick={handleAllClick}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-400/40 text-xs font-mono font-medium text-zinc-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>View Orders History</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              ) : (
                /* List of incomplete orders */
                orders.map((order) => {
                  const meta = STATUS_META[order.status] || STATUS_META.transmitted;
                  const statusLabel = STATUS_DISPLAY_NAMES[order.status] || meta.label || order.status;
                  const itemCount = (order.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);

                  return (
                    <div
                      key={order.order_id}
                      onClick={() => handleCardClick(order.order_id)}
                      className="group relative rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/10 hover:border-amber-400/50 p-4 transition-all duration-200 cursor-pointer shadow-md hover:shadow-[0_8px_25px_rgba(245,158,11,0.12)] active:scale-[0.99] overflow-hidden"
                    >
                      {/* Top Row: Order ID, Table Pill, Time Ago, Status */}
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-amber-400 group-hover:text-amber-300 tracking-wide">
                            #{order.order_id}
                          </span>
                          <span className="text-[11px] px-2 py-0.5 rounded-md font-mono font-medium bg-white/5 text-zinc-300 border border-white/10">
                            {order.table_id === 'COUNTER' ? 'Pick-up Window' : `Table ${order.table_id}`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1">
                            <Clock size={11} className="text-zinc-500" />
                            {timeAgo(order.created_at)}
                          </span>

                          <span
                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shadow-sm"
                            style={{
                              backgroundColor: `${meta.color}15`,
                              color: meta.color,
                              borderColor: `${meta.color}35`,
                            }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                              style={{ backgroundColor: meta.color }}
                            />
                            <span>{statusLabel}</span>
                          </span>
                        </div>
                      </div>

                      {/* Customer Name */}
                      <p className="text-xs font-semibold text-white mb-1.5 truncate">
                        {order.customer_name || 'Guest Customer'}
                      </p>

                      {/* Items Summary */}
                      <div className="text-xs text-zinc-300 line-clamp-2 leading-relaxed mb-2.5 font-normal">
                        {(order.items && order.items.length > 0) ? (
                          order.items.map((it, idx) => (
                            <span key={idx}>
                              <span className="font-semibold text-amber-300">{it.quantity}×</span> {it.name}
                              {idx < order.items.length - 1 ? ', ' : ''}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-500 italic">No food items detailed</span>
                        )}
                      </div>

                      {/* Customer Note if present */}
                      {order.notes && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-300/80 italic mb-2.5 truncate">
                          <MessageSquare size={11} className="shrink-0 text-amber-400" />
                          <span>{order.notes}</span>
                        </div>
                      )}

                      {/* Bottom Row: Total Price and CTA hint */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                        <div className="font-mono font-bold text-white text-sm">
                          ${(Number(order.total) || 0).toFixed(2)}
                          <span className="text-[10px] text-zinc-400 font-normal ml-1">
                            ({itemCount} {itemCount === 1 ? 'item' : 'items'})
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 group-hover:text-amber-300 transition-colors uppercase tracking-wider">
                          <span>View in Orders</span>
                          <ChevronRight size={13} className="transition-transform group-hover:translate-x-1" />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {orders.length > 0 && (
              <div className="pt-4 border-t border-white/10 flex items-center justify-between shrink-0">
                <span className="text-xs text-zinc-400 font-mono">
                  {orders.length} order{orders.length === 1 ? '' : 's'} waiting for completion
                </span>
                <button
                  type="button"
                  onClick={handleAllClick}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black text-xs font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.25)] cursor-pointer active:scale-95"
                >
                  <span>Go to Orders Page</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
