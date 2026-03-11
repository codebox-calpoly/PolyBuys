import {
  formatPrice,
  formatDate,
  isCalPolyEmail,
  isAllowedEmail,
  getEmailValidationError,
  parseCsvList,
} from '../index';

describe('formatPrice', () => {
  it('formats prices with two decimals', () => {
    expect(formatPrice(1234.56)).toBe('$1,234.56');
    expect(formatPrice(0)).toBe('$0.00');
    expect(formatPrice(5)).toBe('$5.00');
  });

  it('handles large numbers', () => {
    expect(formatPrice(1000000)).toBe('$1,000,000.00');
  });
});

describe('formatDate', () => {
  it('formats dates correctly', () => {
    const timestamp = new Date('2025-01-15T12:00:00Z').getTime();
    const result = formatDate(timestamp);
    expect(result).toMatch(/Jan(uary)? 15, 2025/);
  });
});

describe('isCalPolyEmail', () => {
  it('accepts valid Cal Poly emails', () => {
    expect(isCalPolyEmail('student@calpoly.edu')).toBe(true);
    expect(isCalPolyEmail('test.user@calpoly.edu')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isCalPolyEmail('student@gmail.com')).toBe(false);
    expect(isCalPolyEmail('invalid@notcalpoly.edu')).toBe(false);
    expect(isCalPolyEmail('notanemail')).toBe(false);
  });
});

describe('isAllowedEmail', () => {
  it('defaults to calpoly domain when options omitted', () => {
    expect(isAllowedEmail('student@calpoly.edu')).toBe(true);
    expect(isAllowedEmail('student@gmail.com')).toBe(false);
  });

  it('supports explicit allowlist emails', () => {
    expect(
      isAllowedEmail('ios-review@polybuys.com', {
        allowedDomains: ['calpoly.edu'],
        allowedEmails: ['ios-review@polybuys.com'],
      })
    ).toBe(true);
  });

  it('supports multiple allowed domains', () => {
    expect(
      isAllowedEmail('qa@polybuys.com', { allowedDomains: ['calpoly.edu', 'polybuys.com'] })
    ).toBe(true);
  });
});

describe('getEmailValidationError', () => {
  it('returns null for valid allowlisted email', () => {
    expect(
      getEmailValidationError('ios-review@polybuys.com', {
        allowedDomains: ['calpoly.edu'],
        allowedEmails: ['ios-review@polybuys.com'],
      })
    ).toBeNull();
  });

  it('returns domain-specific validation message', () => {
    expect(getEmailValidationError('not-valid@gmail.com')).toBe(
      'Email must be a @calpoly.edu address'
    );
  });
});

describe('parseCsvList', () => {
  it('parses comma-separated values and trims whitespace', () => {
    expect(parseCsvList(' calpoly.edu, polybuys.com ,,')).toEqual(['calpoly.edu', 'polybuys.com']);
  });
});
