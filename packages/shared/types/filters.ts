// Filter and pagination types for listings search

import { ListingCategory, ListingStatus, ListingCondition } from './listing';

// Re-export for convenience
export type { ListingCondition } from './listing';

/**
 * Sort options for listings
 */
export type ListingSortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc';

/**
 * Filters for searching listings
 */
export interface ListingFilters {
  /** Full-text search term (searches title and description) */
  searchTerm?: string;
  /** Filter by category */
  category?: ListingCategory;
  /** Filter by minimum price */
  minPrice?: number;
  /** Filter by maximum price */
  maxPrice?: number;
  /** Filter by item condition */
  condition?: ListingCondition;
  /** Sort order (default: newest) */
  sortBy?: ListingSortOption;
  /** Filter by status (default: active) */
  status?: ListingStatus;
}

/**
 * Paginated result wrapper
 */
export interface PaginatedResult<T> {
  /** Items in current page */
  items: T[];
  /** Cursor for next page (null if no more pages) */
  nextCursor: string | null;
  /** Whether there are more results */
  hasMore: boolean;
}
