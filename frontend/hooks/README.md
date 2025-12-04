# Custom Hooks

This directory contains reusable React hooks for the app.

## Organization

```
hooks/
├── useListings.ts    # Example: Fetch and manage listings
├── useAuth.ts        # Example: Handle authentication
└── README.md         # This file
```

## Creating Custom Hooks

1. **Name hooks with `use` prefix**
2. **Return clear, documented values**
3. **Handle loading and error states**

## Example Hook

```typescript
import { useQuery } from 'convex/react';
import { api } from '../../backend/convex/_generated/api';
import type { Listing } from '@polybuy/shared';

export function useListings() {
  const listings = useQuery(api.listings.getListings);

  return {
    listings: listings ?? [],
    isLoading: listings === undefined,
  };
}
```

## Usage in Components

```typescript
import { useListings } from '@/hooks/useListings';

export function HomeScreen() {
  const { listings, isLoading } = useListings();

  if (isLoading) return <LoadingSpinner />;

  return <ListingsList listings={listings} />;
}
```

## Best Practices

- Keep hooks focused on a single concern
- Always handle loading/error states
- Document parameters and return values
- Export types for hook return values
