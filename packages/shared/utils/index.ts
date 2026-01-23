// Utility functions shared across frontend and backend

/**
 * Format price in USD
 */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
}

/**
 * Format date to readable string
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Validate Cal Poly email using regex
 * Matches emails ending with @calpoly.edu
 */
export function isCalPolyEmail(email: string): boolean {
  const calPolyEmailRegex = /^[a-zA-Z0-9._%+-]+@calpoly\.edu$/i;
  return calPolyEmailRegex.test(email);
}

/**
 * Get validation error message for email
 */
export function getEmailValidationError(email: string): string | null {
  if (!email) {
    return 'Email is required';
  }
  if (!isCalPolyEmail(email)) {
    return 'Email must be a @calpoly.edu address';
  }
  return null;
}
