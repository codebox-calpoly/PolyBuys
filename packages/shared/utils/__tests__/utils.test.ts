import { formatPrice, formatDate, isCalPolyEmail } from '../index';

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
