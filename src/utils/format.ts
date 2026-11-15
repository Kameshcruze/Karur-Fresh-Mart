/**
 * Format a numeric amount in Indian Rupees with Indian number grouping (e.g., 6890 -> ₹6,890).
 */
export function formatINR(amount: number): string {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  const absFormatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(Math.abs(rounded));

  return rounded < 0 ? `-₹${absFormatted}` : `₹${absFormatted}`;
}

/**
 * Calculate whole-percentage discount between MRP and selling price.
 */
export function calculateDiscountPercent(mrp: number, price: number): number {
  if (!Number.isFinite(mrp) || !Number.isFinite(price) || mrp <= 0 || price >= mrp) {
    return 0;
  }
  return Math.round(((mrp - price) / mrp) * 100);
}

/**
 * Format an ISO timestamp as a concise readable Indian date & time (e.g., 15 Nov, 01:45 PM).
 */
export function formatDateTime(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

