const GRADUATION_YEAR_WINDOW_SIZE = 6;

type GraduationYearValue = string | number | null | undefined;

type GraduationYearOptionsConfig = {
  referenceDate?: Date;
  preserveYear?: GraduationYearValue;
};

function normalizeGraduationYearValue(value: GraduationYearValue): string {
  return String(value ?? '').trim();
}

function buildRollingGraduationYears(referenceDate: Date): string[] {
  const startYear = referenceDate.getFullYear();
  return Array.from({ length: GRADUATION_YEAR_WINDOW_SIZE }, (_, index) =>
    String(startYear + index)
  );
}

export function getGraduationYearOptions({
  referenceDate = new Date(),
  preserveYear,
}: GraduationYearOptionsConfig = {}): string[] {
  const rollingYears = buildRollingGraduationYears(referenceDate);
  const normalizedPreserveYear = normalizeGraduationYearValue(preserveYear);

  if (!/^\d{4}$/.test(normalizedPreserveYear) || rollingYears.includes(normalizedPreserveYear)) {
    return rollingYears;
  }

  return [...rollingYears, normalizedPreserveYear].sort(
    (left, right) => Number(left) - Number(right)
  );
}

export const GRADUATION_YEAR_OPTIONS = getGraduationYearOptions();
export const GRADUATION_YEAR_DEFAULT = GRADUATION_YEAR_OPTIONS[0];
export const GRADUATION_YEAR_MIN = Number(GRADUATION_YEAR_OPTIONS[0]);
export const GRADUATION_YEAR_MAX = Number(
  GRADUATION_YEAR_OPTIONS[GRADUATION_YEAR_OPTIONS.length - 1]
);

export function isSupportedGraduationYear(
  value: GraduationYearValue,
  options: readonly string[] = GRADUATION_YEAR_OPTIONS
): boolean {
  return options.includes(normalizeGraduationYearValue(value));
}
