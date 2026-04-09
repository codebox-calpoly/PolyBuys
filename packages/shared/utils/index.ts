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

export type EmailValidationOptions = {
  allowedDomains?: string[];
  allowedEmails?: string[];
};

function normalizeEmailAddress(value: string): string {
  return value.trim().toLowerCase();
}

function hasValidEmailShape(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}$/i.test(email);
}

export function parseCsvList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function isAllowedEmail(email: string, options?: EmailValidationOptions): boolean {
  const normalizedEmail = normalizeEmailAddress(email);
  if (!hasValidEmailShape(normalizedEmail)) {
    return false;
  }

  const allowedEmails = (options?.allowedEmails ?? []).map(normalizeEmailAddress);
  if (allowedEmails.includes(normalizedEmail)) {
    return true;
  }

  const allowedDomains = (options?.allowedDomains ?? ['calpoly.edu']).map((domain) =>
    domain.trim().toLowerCase()
  );
  const domain = normalizedEmail.split('@')[1];
  return allowedDomains.includes(domain);
}

/**
 * Get validation error message for email
 */
export function getEmailValidationError(
  email: string,
  options?: EmailValidationOptions
): string | null {
  if (!email) {
    return 'Email is required';
  }

  if (!hasValidEmailShape(email)) {
    return 'Enter a valid email address';
  }

  if (!isAllowedEmail(email, options)) {
    const allowedDomains = options?.allowedDomains?.filter(
      (domain) => domain.trim().length > 0
    ) ?? ['calpoly.edu'];
    if (allowedDomains.length === 1) {
      return `Email must be a @${allowedDomains[0]} address`;
    }
    return `Email must use one of these domains: ${allowedDomains.map((d) => `@${d}`).join(', ')}`;
  }
  return null;
}
