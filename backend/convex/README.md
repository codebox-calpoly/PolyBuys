# PolyBuys Backend (Convex)

This directory contains the Convex serverless backend for PolyBuys.

**Note**: We use self-hosted Convex deployed on Railway, not Convex cloud.

## Getting Started

First, create `backend/.env.local` with:

```bash
CONVEX_SELF_HOSTED_URL='https://api.polybuys.com'
CONVEX_SELF_HOSTED_ADMIN_KEY='<admin-key-from-team>'
```

Then run the Convex development server:

```bash
npm run dev:backend
```

This connects to our self-hosted Convex backend, watches for changes, and syncs your schema and functions to the deployment.

## Project Structure

- **`schema.ts`** - Database schema definitions (tables, indexes)
- **`listings.ts`** - CRUD functions for marketplace listings
- **`_generated/`** - Auto-generated types (do not edit manually)
- **`__tests__/`** - Test files for backend functions

## Adding New Functions

Create new `.ts` files in this directory and export query/mutation functions:

```ts
import { query } from './_generated/server';
import { v } from 'convex/values';

export const myQuery = query({
  args: { id: v.id('tableName') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});
```

## Updating the Schema

Edit `schema.ts` to add tables or modify fields. Convex will automatically migrate your data.

## Resources

- [Convex Docs](https://docs.convex.dev)
- [Functions Guide](https://docs.convex.dev/functions)
- [Database Guide](https://docs.convex.dev/database)
