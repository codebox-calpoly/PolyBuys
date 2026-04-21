import { getGraduationYearOptions, isSupportedGraduationYear } from '../graduationYears';

describe('graduation year options', () => {
  it('builds a six-year rolling window from the current year', () => {
    expect(getGraduationYearOptions({ referenceDate: new Date('2027-02-10T12:00:00Z') })).toEqual([
      '2027',
      '2028',
      '2029',
      '2030',
      '2031',
      '2032',
    ]);
  });

  it('preserves an existing stored year outside the rolling window', () => {
    const options = getGraduationYearOptions({
      referenceDate: new Date('2026-04-21T12:00:00Z'),
      preserveYear: 2025,
    });

    expect(options).toEqual(['2025', '2026', '2027', '2028', '2029', '2030', '2031']);
    expect(isSupportedGraduationYear('2025', options)).toBe(true);
  });

  it('does not duplicate a preserved year that already falls inside the rolling window', () => {
    expect(
      getGraduationYearOptions({
        referenceDate: new Date('2026-04-21T12:00:00Z'),
        preserveYear: 2028,
      })
    ).toEqual(['2026', '2027', '2028', '2029', '2030', '2031']);
  });
});
