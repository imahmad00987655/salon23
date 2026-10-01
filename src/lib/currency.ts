/** Currency symbol for display (Pakistani Rupee) */
export const CURRENCY = "Rs.";

/**
 * Format a number with thousand / million separators.
 * Example: 1230246.5 -> "1,230,246.50"
 */
export function formatAmount(value: unknown, decimals = 2): string {
  const n = Number(value ?? 0);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format money with Rs. prefix + commas.
 * Example: 1230246 -> "Rs. 1,230,246.00"
 */
export function formatMoney(value: unknown, decimals = 2): string {
  return `${CURRENCY} ${formatAmount(value, decimals)}`;
}
