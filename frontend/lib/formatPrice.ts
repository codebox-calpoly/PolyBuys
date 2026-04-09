/**
 * Format a price for display with two decimal places.
 * e.g. 15 -> "15.00", 15.5 -> "15.50"
 */
export function formatPrice(price: number): string {
  return Number(price).toFixed(2);
}
