import { majorMatchesQuery } from '../calPolyMajors';

describe('majorMatchesQuery', () => {
  it('keeps campus parentheticals searchable', () => {
    expect(majorMatchesQuery('Mechanical Engineering (BS) (Solano Campus)', 'solano')).toBe(true);
    expect(
      majorMatchesQuery('Mechanical Engineering (BS) (San Luis Obispo Campus)', 'luis obispo')
    ).toBe(true);
  });

  it('continues to ignore degree suffixes while matching the major name', () => {
    expect(majorMatchesQuery('Computer Science (BS)', 'computer science')).toBe(true);
    expect(majorMatchesQuery('Computer Science (BS)', 'bs')).toBe(false);
  });
});
