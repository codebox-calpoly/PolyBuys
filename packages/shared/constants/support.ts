export const SUPPORT_REPORT_CATEGORIES = [
  'bug',
  'account_login',
  'listing',
  'messages',
  'payments_offers',
  'safety',
  'other',
] as const;

export type SupportReportCategory = (typeof SUPPORT_REPORT_CATEGORIES)[number];

export const SUPPORT_REPORT_DESCRIPTION_MAX = 1200;
export const SUPPORT_REPORT_CONTEXT_VALUE_MAX = 240;
export const SUPPORT_REPORTS_PER_TEN_MINUTES = 3;
export const SUPPORT_REPORTS_PER_DAY = 10;
