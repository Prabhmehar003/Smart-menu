// src/pdfInvoice.js
/**
 * Shared PDF invoice generator used by both the admin OrdersPage
 * and the customer post-checkout tracking screen.
 *
 * Requires: npm install jspdf
 */
import { jsPDF } from 'jspdf';

/**
 * @param {object} order        - Full order object (items[], total, etc.)
 * @param {object} settings     - Settings object from /api/settings
 * @param {'admin'|'customer'} role
 */
export function downloadOrderPDF(order, settings = {}, role = 'admin') {
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });

  const currency = settings.currency || 'USD';
  const currencySymbol = currency === 'USD' ? '$'
    : currency === 'EUR' ? '€'
    : currency === 'GBP' ? '£'
    : '$';

  const restaurantName = settings.restaurant_name || 'Restaurant';
  const taxRate = parseFloat(settings.tax_rate) || 0;
  const serviceCharge = parseFloat(settings.service_charge) || 0;
  const phone = settings.phone || '';
  const address = settings.address || '';

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  // ── Header ──────────────────────────────────────────────────────────
  doc.setFillColor(214, 255, 0);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(10, 10, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(restaurantName, margin, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  if (address) doc.text(address, margin, 18);
  if (phone) doc.text(`Tel: ${phone}`, margin, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageW - margin, 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Order #${order.order_id}`, pageW - margin, 18, { align: 'right' });
  doc.text(
    new Date(order.created_at.replace(' ', 'T') + 'Z').toLocaleString(),
    pageW - margin, 22,
    { align: 'right' }
  );

  y = 36;

  // ── Customer / Table info ────────────────────────────────────────────
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('BILLED TO', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(order.customer_name || '—', margin, y + 5);
  if (order.customer_email) doc.text(order.customer_email, margin, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.text('TABLE', pageW - margin - 30, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(18);
  doc.text(String(order.table_id), pageW - margin, y + 7, { align: 'right' });

  y += 22;

  // ── Divider ──────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── Items table header ───────────────────────────────────────────────
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 100, 100);
  doc.text('ITEM', margin, y);
  doc.text('QTY', pageW - margin - 46, y, { align: 'right' });
  doc.text('UNIT', pageW - margin - 24, y, { align: 'right' });
  doc.text('TOTAL', pageW - margin, y, { align: 'right' });
  y += 4;

  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // ── Items ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 30, 30);
  doc.setFontSize(8);

  for (const item of order.items || []) {
    const lineTotal = (item.price * item.quantity).toFixed(2);
    doc.text(item.name, margin, y);
    doc.text(String(item.quantity), pageW - margin - 46, y, { align: 'right' });
    doc.text(`${currencySymbol}${parseFloat(item.price).toFixed(2)}`, pageW - margin - 24, y, { align: 'right' });
    doc.text(`${currencySymbol}${lineTotal}`, pageW - margin, y, { align: 'right' });
    y += 6;
  }

  // ── Notes ────────────────────────────────────────────────────────────
  if (order.notes) {
    y += 2;
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont('helvetica', 'italic');
    doc.text(`Note: ${order.notes}`, margin, y);
    y += 6;
  }

  // ── Totals ───────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  const subtotal = order.total || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const serviceAmount = subtotal * (serviceCharge / 100);
  const grandTotal = subtotal + taxAmount + serviceAmount;

  const totalsLeft = pageW - margin - 60;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);

  doc.text('Subtotal', totalsLeft, y);
  doc.text(`${currencySymbol}${subtotal.toFixed(2)}`, pageW - margin, y, { align: 'right' });
  y += 6;

  if (taxRate > 0) {
    doc.text(`Tax (${taxRate}%)`, totalsLeft, y);
    doc.text(`${currencySymbol}${taxAmount.toFixed(2)}`, pageW - margin, y, { align: 'right' });
    y += 6;
  }

  if (serviceCharge > 0) {
    doc.text(`Service Charge (${serviceCharge}%)`, totalsLeft, y);
    doc.text(`${currencySymbol}${serviceAmount.toFixed(2)}`, pageW - margin, y, { align: 'right' });
    y += 6;
  }

  doc.setLineWidth(0.5);
  doc.setDrawColor(10, 10, 10);
  doc.line(totalsLeft, y, pageW - margin, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(10, 10, 10);
  doc.text('TOTAL', totalsLeft, y);
  doc.text(`${currencySymbol}${grandTotal.toFixed(2)}`, pageW - margin, y, { align: 'right' });
  y += 12;

  // ── Status badge (admin-only) ─────────────────────────────────────────
  if (role === 'admin' && order.status) {
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    const statusLabel = order.status.toUpperCase();
    const statusColors = {
      transmitted: [0, 180, 255],
      preparing: [255, 180, 0],
      ready: [100, 220, 100],
      served: [160, 100, 255],
      cancelled: [255, 80, 80],
    };
    const [r, g, b] = statusColors[order.status] || [150, 150, 150];
    doc.setFillColor(r, g, b);
    doc.roundedRect(margin, y - 4, 32, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.text(statusLabel, margin + 16, y + 0.5, { align: 'center' });
    y += 10;
  }

  // ── Footer ────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(160, 160, 160);
  doc.text('Thank you for dining with us!', pageW / 2, y, { align: 'center' });
  doc.text(
    `Generated ${new Date().toLocaleString()}`,
    pageW / 2, y + 5,
    { align: 'center' }
  );

  doc.save(`invoice-${order.order_id}.pdf`);
}