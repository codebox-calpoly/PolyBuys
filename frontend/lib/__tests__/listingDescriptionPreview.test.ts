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

  it('treats each Enter-separated line as a bullet even without markers or short-line limits', () => {
    const lineA = 'A'.repeat(160);
    const lineB = 'B'.repeat(160);
    const r = buildDescriptionPreview(`${lineA}\n${lineB}`);
    expect(r.kind).toBe('bullets');
    if (r.kind === 'bullets') {
      expect(r.items).toHaveLength(2);
      expect(r.items[0]).toMatch(/^A+/);
      expect(r.items[1]).toMatch(/^B+/);
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

  it('splits numbered lists without space after the dot and without sentence periods', () => {
    const r = buildDescriptionPreview('1.Pickup near library\n2.Cash or Venmo only');
    expect(r.kind).toBe('bullets');
    if (r.kind === 'bullets') {
      expect(r.items[0]).toContain('Pickup');
      expect(r.items[1]).toContain('Venmo');
    }
  });

  it('splits inline numbered items on one line', () => {
    const r = buildDescriptionPreview('1. Pickup Tuesday 2. Cash only 3. Price firm');
    expect(r.kind).toBe('bullets');
    if (r.kind === 'bullets') {
      expect(r.items).toHaveLength(3);
      expect(r.items[0]).toMatch(/Pickup/);
      expect(r.items[1]).toMatch(/Cash/);
      expect(r.items[2]).toMatch(/firm/);
    }
  });

  it('does not treat version numbers like 2.0 as list markers', () => {
    const r = buildDescriptionPreview('Runs v2.0 firmware; like new; box included');
    expect(r.kind).toBe('bullets');
    if (r.kind === 'bullets') {
      expect(r.items.join(' ')).not.toMatch(/^2\.0$/);
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

  it('drops flush prose after the last numbered item', () => {
    const r = buildDescriptionPreview(
      '1. Pickup Tuesday\n2. Cash or Venmo\nContact me for other arrangements.'
    );
    expect(r.kind).toBe('bullets');
    if (r.kind === 'bullets') {
      expect(r.items).toHaveLength(2);
      expect(r.items[1]).toContain('Venmo');
      expect(r.items.join(' ')).not.toContain('Contact');
    }
  });

  it('drops prose after a single dash bullet when the rest is unmarked', () => {
    const r = buildDescriptionPreview('- Like new desk\nMust pick up this week from Poly.');
    expect(r.kind).toBe('bullets');
    if (r.kind === 'bullets') {
      expect(r.items).toHaveLength(1);
      expect(r.items[0]).toContain('desk');
      expect(r.items.join(' ')).not.toContain('pick up this week');
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
