// Source: Official Cal Poly Academic Catalog "Programs" page
// https://catalog.calpoly.edu/programs/
// Undergraduate bachelor degree majors, accessed April 21, 2026.

export const CAL_POLY_MAJORS = [
  'Aerospace Engineering (BS)',
  'Agricultural Business (BS)',
  'Agricultural Communication (BS)',
  'Agricultural Science (BS)',
  'Agricultural Systems Management (BS)',
  'Animal Science (BS)',
  'Anthropology and Geography (BS)',
  'Architectural Engineering (BS)',
  'Architecture (BArch)',
  'Art and Design (BFA)',
  'Biochemistry (BS)',
  'Biological Sciences (BS)',
  'Biomedical Engineering (BS)',
  'BioResource and Agricultural Engineering (BS)',
  'Business Administration (BS)',
  'Chemistry (BS)',
  'Child Development (BS)',
  'City and Regional Planning (BS)',
  'Civil Engineering (BS)',
  'Communication Studies (BA)',
  'Comparative Ethnic Studies (BA)',
  'Computer Engineering (BS)',
  'Computer Science (BS)',
  'Construction Management (BS)',
  'Dairy Science (BS)',
  'Economics (BS)',
  'Electrical Engineering (BS)',
  'English (BA)',
  'Environmental Earth and Soil Sciences (BS)',
  'Environmental Engineering (BS)',
  'Environmental Management and Protection (BS)',
  'Experience and Event Management (BS)',
  'Facilities Engineering Technology (BS)',
  'Food Science (BS)',
  'Forest and Fire Sciences (BS)',
  'General Engineering (BS)',
  'Graphic Communication (BS)',
  'History (BA)',
  'Industrial Engineering (BS)',
  'Industrial Technology and Packaging (BS)',
  'Interdisciplinary Studies (BA)',
  'International Strategy and Security (BA)',
  'Journalism (BS)',
  'Kinesiology (BS)',
  'Landscape Architecture (BLA)',
  'Liberal Arts and Engineering Studies (BS)',
  'Liberal Studies (BS)',
  'Manufacturing Engineering (BS)',
  'Marine Engineering Technology (BS)',
  'Marine Sciences (BS)',
  'Marine Transportation (BS)',
  'Materials Engineering (BS)',
  'Mathematics (BS)',
  'Mechanical Engineering (BS) (San Luis Obispo Campus)',
  'Mechanical Engineering (BS) (Solano Campus)',
  'Microbiology (BS)',
  'Music (BA)',
  'Nutrition (BS)',
  'Oceanography (BS)',
  'Philosophy (BA)',
  'Physics (BA)',
  'Physics (BS)',
  'Plant Sciences (BS)',
  'Political Science (BA)',
  'Psychology (BS)',
  'Public Health (BS)',
  'Sociology (BA)',
  'Software Engineering (BS)',
  'Spanish (BA)',
  'Statistics (BS)',
  'Theatre Arts (BA)',
  'Wine and Viticulture (BS)',
] as const;

const SEARCH_STRIPPED_PARENTHETICAL_PATTERN =
  /^(?:ba|barch|bfa|bla|bs|ma|mba|minor|ms|certificate|certificates|concentration|concentrations|credential|credentials)$/i;
const SEARCH_CAMPUS_TERMS = ['campus', 'san luis obispo', 'solano'];

function normalizeParentheticalForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function shouldStripParentheticalFromMajorSearch(value: string): boolean {
  const normalized = normalizeParentheticalForSearch(value);
  if (!normalized) {
    return true;
  }

  if (SEARCH_CAMPUS_TERMS.some((term) => normalized.includes(term))) {
    return false;
  }

  return SEARCH_STRIPPED_PARENTHETICAL_PATTERN.test(normalized);
}

function normalizeMajorSearchValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\(([^)]*)\)/g, (_match, innerText: string) =>
      shouldStripParentheticalFromMajorSearch(innerText) ? ' ' : ` ${innerText} `
    )
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function majorMatchesQuery(major: string, query: string): boolean {
  const normalizedQuery = normalizeMajorSearchValue(query);
  if (!normalizedQuery) {
    return true;
  }

  const normalizedMajor = normalizeMajorSearchValue(major);
  return normalizedMajor.includes(normalizedQuery);
}

export function isCalPolyMajor(value: string): boolean {
  return CAL_POLY_MAJORS.includes(value as (typeof CAL_POLY_MAJORS)[number]);
}

export function formatMajorLabel(major: string): string {
  return major.replace(/\s+\((?:BA|BArch|BFA|BLA|BS)\)(?=\s+\(|$)/, '');
}
