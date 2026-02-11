import type { ListingCategory } from '@polybuys/shared';

// Re-export ListingCategory as Category for frontend convenience
export type Category = ListingCategory;

export interface Filters {
  category?: Category;
  minPrice?: number;
  maxPrice?: number;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  textbooks: 'Textbooks',
  electronics: 'Electronics',
  furniture: 'Furniture',
  tickets: 'Tickets',
  other: 'Other',
};

export const CATEGORIES: { value: Category | undefined; label: string }[] = [
  { value: undefined, label: 'All Categories' },
  { value: 'textbooks', label: CATEGORY_LABELS.textbooks },
  { value: 'electronics', label: CATEGORY_LABELS.electronics },
  { value: 'furniture', label: CATEGORY_LABELS.furniture },
  { value: 'tickets', label: CATEGORY_LABELS.tickets },
  { value: 'other', label: CATEGORY_LABELS.other },
];
