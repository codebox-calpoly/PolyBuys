import { buildDescriptionPreview } from '../listingDescriptionPreview';

describe('buildDescriptionPreview', () => {
  it('returns none for empty', () => {
    expect(buildDescriptionPreview('')).toEqual({ kind: 'none' });
    expect(buildDescriptionPreview('   \n')).toEqual({ kind: 'none' });
  });

  it('uses line breaks / markers as bullets', () => {
    const r = buildDescriptionPreview('Great desk\nPickup near campus\nCash only');
    expect(r.kind).toBe('bullets');
    if (r.kind === 'bullets') {
      expect(r.items).toHaveLength(3);
      expect(r.items[0]).toContain('Great desk');
    }
  });

  it('strips leading list markers', () => {
    const r = buildDescriptionPreview('- First point\n• Second\n1) Third');
    expect(r.kind).toBe('bullets');
    if (r.kind === 'bullets') {
      expect(r.items[0]).toBe('First point');
      expect(r.items[1]).toBe('Second');
      expect(r.items[2]).toBe('Third');
    }
  });

  it('drops unmarked prose after the last bullet line', () => {
    const r = buildDescriptionPreview(
      '- Pickup near campus\n- Cash or Venmo\nI can also deliver for an extra fee if you need that.'
    );
    expect(r.kind).toBe('bullets');
    if (r.kind === 'bullets') {
      expect(r.items).toHaveLength(2);
      expect(r.items[1]).toContain('Venmo');
      expect(r.items.join(' ')).not.toContain('deliver');
    }
  });

  it('uses semicolon-separated clauses', () => {
    const r = buildDescriptionPreview(
      'Like new MacBook; includes charger and box; pickup Poly Canyon weekdays'
    );
    expect(r.kind).toBe('bullets');
    if (r.kind === 'bullets') {
      expect(r.items.length).toBeGreaterThanOrEqual(2);
      expect(r.items[0]).toMatch(/MacBook/i);
    }
  });

  it('falls back to sentence bullets for prose with multiple sentences', () => {
    const r = buildDescriptionPreview(
      'Selling my bike because I am graduating. Tires replaced last year. Great for campus hills.'
    );
    if (r.kind === 'bullets') {
      expect(r.items.length).toBeGreaterThanOrEqual(2);
    } else {
      expect(r.kind).toBe('plain');
    }
  });

  it('uses plain for a single short sentence', () => {
    const r = buildDescriptionPreview('One owner, smoke free.');
    expect(r.kind).toBe('plain');
  });
});
