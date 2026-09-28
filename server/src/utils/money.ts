/**
 * Money utilities using integer Paise (1 INR = 100 Paise)
 * Prevents all floating point inaccuracies.
 */

export function rupeesToPaise(rupees: number | string): number {
  if (typeof rupees === 'string') {
    rupees = parseFloat(rupees.trim().replace(/,/g, ''));
  }
  if (isNaN(rupees)) return 0;
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: number): number {
  return Number((paise / 100).toFixed(2));
}

export function formatINR(paise: number, showSymbol = true): string {
  const rupees = paise / 100;
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
  return showSymbol ? `₹${formatted}` : formatted;
}

export function calculatePercentage(partial: number, total: number): number {
  if (total <= 0) return 0;
  const pct = (partial / total) * 100;
  return Number(pct.toFixed(1));
}
