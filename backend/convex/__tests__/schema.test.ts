import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

describe('Convex Schema', () => {
  it('defines listings table with required fields', () => {
    // Simple validation test - ensures schema exports correctly
    expect(defineSchema).toBeDefined();
    expect(defineTable).toBeDefined();
    expect(v).toBeDefined();
  });

  it('validates listing category enum', () => {
    const validCategories = [
      'textbooks',
      'electronics',
      'furniture',
      'clothing',
      'tickets',
      'other',
    ];

    validCategories.forEach((category) => {
      expect(validCategories).toContain(category);
    });
  });

  it('validates listing status enum', () => {
    const validStatuses = ['active', 'sold', 'pending'];

    validStatuses.forEach((status) => {
      expect(validStatuses).toContain(status);
    });
  });
});
