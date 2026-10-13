// src/OrderTracking.jsx
/**
 * Post-checkout live order tracking screen.
 * Used by CustomerMenuApp after a successful order.
 * Polls GET /api/orders/{order_id}?session_token=... every 10 seconds.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Clock, ChefHat, Bell, XCircle,
  RefreshCw, FileDown, ArrowLeft,
} from 'lucide-react';
import { api } from './api';
import { downloadOrderPDF } from './pdfInvoice';

const STATUS_STEPS = [
  { key: 'transmitted', label: 'Order Received', icon: CheckCircle2, color: '#00C2D6' },
  { key: 'preparing',   label: 'Being Prepared', icon: ChefHat,      color: '#FFB800' },
  { key: 'ready',       label: 'Ready to Serve', icon: Bell,          color: '#D6FF00' },
  { key: 'served',      label: 'Served',          icon: CheckCircle2, color: '#A855F7' },
];

function statusIndex(status) {
  return STATUS_STEPS.findIndex((s) => s.key === status);
}

export function OrderTracking({ orderId, sessionToken, tableId, onClose, settings = {} }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [polling, setPolling] = useState(true);

  const currency = settings.currency || 'USD';
  const currencySymbol = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
  const taxRate = parseFloat(settings.tax_rate) || 0;
  const serviceCharge = parseFloat(settings.service_charge) || 0;

  const fetchOrder = useCallback(async () => {
    try {
      const data = await api.getOrderForCustomer(orderId, sessionToken);
      setOrder(data);
      setError(null);
      // Stop polling once terminal status reached
      if (data.status === 'served' || data.status === 'cancelled') {
        setPolling(false);
      }
    } catch (e) {
      setError(e.message);
    }
  }, [orderId, sessionToken]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  useEffect(() => {
    if (!polling) return;
    const id = setInterval(fetchOrder, 10_000);
    return () => clearInterval(id);
  }, [polling, fetchOrder]);

  const isCancelled = order?.status === 'cancelled';
  const currentStep = order ? statusIndex(order.status) : -1;

  const subtotal = order?.total || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const serviceAmount = subtotal * (serviceCharge / 100);
  const grandTotal = subtotal + taxAmount + serviceAmount;

  return (
    <div className="fixed inset-0 z-50 bg-[#050505]/95 backdrop-blur-xl overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-10">
        {/* Back button with reassurance */}
        <div className="flex items-center justify-between gap-3 mb-8">
          <button
            onClick={onClose}
            className="flex items-center gap-2 font-mono text-xs text-white/70 hover:text-white px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <ArrowLeft size={14} /> Back to menu
          </button>
          <span className="font-mono text-[10px] text-white/40 border border-white/10 rounded-full px-2.5 py-1 bg-white/5">
            ✓ Order saved in menu
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Order ID + table */}
          <div className="text-center">
            <span className="font-mono text-[10px] text-[#00C2D6] tracking-widest uppercase">
              {tableId === 'COUNTER' ? '🛍️ SERVICE WINDOW PICKUP (PRE-PAID)' : `Table ${tableId}`}
            </span>
            <h2 className="text-3xl font-black mt-1">Order #{orderId}</h2>
            {polling && !isCancelled && (
              <p className="font-mono text-[10px] text-white/30 mt-1 flex items-center justify-center gap-1.5">
                <RefreshCw size={10} className="animate-spin" /> Auto-updating
              </p>
            )}
          </div>

          {/* Service Window Pickup Box */}
          {tableId === 'COUNTER' && !isCancelled && (
            <div className="bg-[#00F0FF]/10 border border-[#00F0FF]/40 rounded-2xl p-4 text-center">
              <p className="font-mono text-xs font-bold text-[#00F0FF] uppercase mb-1">
                🛍️ Present Order #{orderId} at Service Window
              </p>
              <p className="font-mono text-[11px] text-white/70 leading-relaxed">
                Your order is pre-paid online. When status reaches <strong>"Ready to Serve"</strong>, please present this screen at the counter.
              </p>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 rounded-2xl p-4 font-mono text-xs text-[#FF3B3B]">
              {error}
            </div>
          )}

          {/* Cancelled state */}
          {isCancelled && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-[#FF3B3B]/10 border border-[#FF3B3B]/30 rounded-3xl p-8 text-center"
            >
              <XCircle className="w-12 h-12 text-[#FF3B3B] mx-auto mb-3" />
              <p className="font-mono font-bold text-[#FF3B3B]">ORDER CANCELLED</p>
              <p className="font-mono text-xs text-white/40 mt-2">
                Please speak to a staff member if this was unexpected.
              </p>
            </motion.div>
          )}

          {/* Progress stepper */}
          {!isCancelled && (
            <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6">
              <div className="space-y-4">
                {STATUS_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const isDone = idx <= currentStep;
                  const isActive = idx === currentStep;
                  return (
                    <div key={step.key} className="flex items-center gap-4">
                      <motion.div
                        animate={isActive ? { scale: [1, 1.12, 1] } : {}}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all duration-500"
                        style={{
                          backgroundColor: isDone ? `${step.color}22` : 'rgba(255,255,255,0.05)',
                          border: `1.5px solid ${isDone ? step.color : 'rgba(255,255,255,0.1)'}`,
                        }}
                      >
                        <Icon
                          size={16}
                          style={{ color: isDone ? step.color : 'rgba(255,255,255,0.2)' }}
                        />
                      </motion.div>
                      <div className="flex-1">
                        <p
                          className="font-mono text-sm font-bold transition-colors duration-500"
                          style={{ color: isDone ? '#ffffff' : 'rgba(255,255,255,0.25)' }}
                        >
                          {step.label}
                        </p>
                      </div>
                      {isActive && (
                        <span
                          className="font-mono text-[9px] font-black px-2.5 py-1 rounded-full"
                          style={{
                            backgroundColor: `${step.color}22`,
                            color: step.color,
                            border: `1px solid ${step.color}55`,
                          }}
                        >
                          NOW
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Bill / invoice */}
          {order && (
            <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6 space-y-4">
              <h3 className="font-mono text-xs text-white/40 uppercase tracking-widest">
                Your Bill
              </h3>

              <div className="space-y-2">
                {order.items?.map((item, i) => (
                  <div key={i} className="flex justify-between font-mono text-sm">
                    <span className="text-white/70">
                      {item.quantity}× {item.name}
                    </span>
                    <span className="text-white/50">
                      {currencySymbol}{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {order.notes && (
                <p className="font-mono text-[11px] text-white/30 italic border-t border-white/5 pt-3">
                  Note: {order.notes}
                </p>
              )}

              <div className="border-t border-white/10 pt-3 space-y-1.5">
                <div className="flex justify-between font-mono text-xs text-white/40">
                  <span>Subtotal</span>
                  <span>{currencySymbol}{subtotal.toFixed(2)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between font-mono text-xs text-white/40">
                    <span>Tax ({taxRate}%)</span>
                    <span>{currencySymbol}{taxAmount.toFixed(2)}</span>
                  </div>
                )}
                {serviceCharge > 0 && (
                  <div className="flex justify-between font-mono text-xs text-white/40">
                    <span>Service ({serviceCharge}%)</span>
                    <span>{currencySymbol}{serviceAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-mono text-base font-black pt-2 border-t border-white/10">
                  <span>TOTAL</span>
                  <span className="text-[#D6FF00]">
                    {currencySymbol}{grandTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* PDF download */}
              <button
                onClick={() => downloadOrderPDF(order, settings, 'customer')}
                className="w-full flex items-center justify-center gap-2 font-mono font-bold text-xs py-3 rounded-2xl border border-[#D6FF00]/40 text-[#D6FF00] hover:bg-[#D6FF00]/10 transition-colors"
              >
                <FileDown size={14} /> Download PDF Invoice
              </button>
            </div>
          )}

          {/* Skeleton while loading first poll */}
          {!order && !error && (
            <div className="bg-white/[0.04] border border-white/10 rounded-3xl p-6 animate-pulse">
              <div className="h-3 bg-white/10 rounded w-1/3 mb-4" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-3 bg-white/5 rounded w-full" />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default OrderTracking;