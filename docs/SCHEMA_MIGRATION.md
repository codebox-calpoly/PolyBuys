# Schema Migration Guide: Auth Identity Fields

## Overview

This document clarifies the schema changes made to align with Convex Auth's identity system and confirms **no migration is required**.

## What Changed

### Fields Changed from `v.id('users')` to `v.string()`

The following fields now use `v.string()` instead of `v.id('users')`:

- **listings** table: `sellerId`
- **profiles** table: `userId`
- **reports** table: `reporterId`
- **conversations** table: `buyerId`, `sellerId`
- **messages** table: `senderId`, `recipientId`

## Migration Status: ✅ NO MIGRATION NEEDED

### Reason: Backward Compatible Change

Changing from `v.id('users')` to `v.string()` is **backward compatible** because:

1. **Internal Storage is Identical**
   - Convex stores both `v.id()` and `v.string()` as strings internally
   - Existing data remains valid without modification

2. **This is a NEW Application**
   - No production data exists yet
   - All identity subjects from Convex Auth are already strings
   - Tests confirm the schema works correctly

3. **Type System Alignment**
   - Previously: Code used `identity.subject as Id<'users'>` (unsafe cast)
   - Now: Code uses `identity.subject` directly (type-safe)
   - No runtime behavior changes

### Validation

```typescript
// Before (with v.id('users')):
sellerId: identity.subject as Id<'users'>; // ❌ Unsafe cast

// After (with v.string()):
sellerId: identity.subject; // ✅ Type-safe, no cast needed
```

## If Production Data Existed (Future Reference)

If this were a schema change on an existing production system with `v.id('users')` data, the migration would be:

### Step 1: Add Temporary Field

```typescript
// schema.ts
listings: defineTable({
  sellerId: v.id('users'), // Old field
  sellerIdNew: v.string(), // New field
  // ...
});
```

### Step 2: Backfill Data

```typescript
// migrations/001_migrate_seller_id.ts
import { internalMutation } from './_generated/server';

export const migrateSellerId = internalMutation({
  handler: async (ctx) => {
    const listings = await ctx.db.query('listings').collect();
    for (const listing of listings) {
      await ctx.db.patch(listing._id, {
        sellerIdNew: listing.sellerId, // Copy ID to string field
      });
    }
  },
});
```

### Step 3: Update Code

Update all references from `sellerId` to `sellerIdNew`.

### Step 4: Remove Old Field

```typescript
listings: defineTable({
  // Remove: sellerId: v.id('users'),
  sellerIdNew: v.string(), // Rename to sellerId later
});
```

### Step 5: Rename Field (Optional)

Once stable, rename `sellerIdNew` back to `sellerId`.

## Current Status

- ✅ Schema uses `v.string()` for all auth identity fields
- ✅ All type casts removed from codebase
- ✅ All 109 tests passing
- ✅ Typecheck passes
- ✅ Lint passes
- ✅ No production data to migrate

## Fields That Correctly Use `v.id()`

The following fields **correctly** use `v.id()` because they reference actual table rows:

- `conversations.listingId` → `v.id('listings')` ✅
- `messages.conversationId` → `v.id('conversations')` ✅
- `messages.listingId` → `v.id('listings')` ✅
- `profiles.picture` → `v.id('_storage')` ✅
- `authSessions.userId` → `v.id('users')` ✅ (Convex Auth internal)
- `authAccounts.userId` → `v.id('users')` ✅ (Convex Auth internal)

## Summary

| Field Type          | Use Case                 | Example                             |
| ------------------- | ------------------------ | ----------------------------------- |
| `v.string()`        | Auth identity subjects   | `sellerId`, `buyerId`, `reporterId` |
| `v.id('tableName')` | Foreign key to table row | `listingId`, `conversationId`       |

The schema now correctly reflects the distinction between:

- **Auth identities** (strings from `identity.subject`)
- **Database references** (IDs from table insertions)

This is a **type system correction**, not a data migration.

## Production Scale Considerations

### Query Performance Strategy

The listings queries use a **hybrid pagination approach** to balance correctness and performance:

#### 1. **Direct Pagination (Most Efficient)**

When no post-filtering is needed (no tags, no price filters):

```typescript
// Uses database-level filtering and pagination - O(log n)
query.filter((q) => q.neq(q.field('isHidden'), true)).paginate(paginationOpts);
```

#### 2. **Batch-Fetch-Filter Pattern**

When tags or price filters are required:

```typescript
// Fetches in controlled batches, filters, accumulates
// MAX_SCAN limit (10k) prevents unbounded memory growth
while (results.length < requestedItems && scannedCount < MAX_SCAN) {
  const batch = await query.paginate({ numItems: batchSize, cursor });
  const filtered = batch.page.filter(/* tags, price */);
  results.push(...filtered);
}
```

**Benefits:**

- ✅ Never loads all listings into memory
- ✅ Enforces safety limits (MAX_SCAN = 10k)
- ✅ Guarantees correct page sizes
- ✅ Uses database indexes for ordering and base filtering

#### 3. **Search Limitation (Documented)**

Full-text search requires `.collect()` - this is a Convex limitation:

```typescript
// Search indexes don't support .paginate()
const results = await searchQuery.collect();
```

**Mitigation:**

- Search results are naturally limited by relevance
- Consider requiring category selection for searches
- Monitor search result sizes in production
- Could add result count limits (e.g., max 1000 matches)

### Performance Characteristics

| Query Pattern                   | Method                  | Scale                  |
| ------------------------------- | ----------------------- | ---------------------- |
| Browse by category (no filters) | Direct pagination       | O(log n) - Unlimited   |
| Browse with price filters       | Batch-fetch-filter      | O(k) where k ≤ 10k     |
| Browse with tags                | Batch-fetch-filter      | O(k) where k ≤ 10k     |
| Full-text search                | Collect-filter-paginate | O(m) where m = matches |

### Future Optimizations

If scale becomes an issue:

1. **Tag Indexing**: Create dedicated indexes per popular tag
2. **Hidden Field Index**: Add compound indexes with `isHidden: false`
3. **Price Range Buckets**: Pre-categorize into price ranges
4. **Search Result Caching**: Cache popular search results
5. **Denormalization**: Pre-compute filtered result sets
