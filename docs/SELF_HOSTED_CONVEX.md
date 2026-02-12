# Self-Hosted Convex Setup

PolyBuys uses **self-hosted Convex** deployed on Railway instead of Convex cloud. This document explains the setup, architecture, and maintenance.

## Architecture

### Services

1. **Convex Backend** - `https://api.polybuys.com` (port 3210)
   - Main API for queries, mutations, and subscriptions
   - Database operations
   - Real-time sync

2. **HTTP Actions** - `https://actions.polybuys.com` (port 3211)
   - HTTP endpoints for webhooks and public APIs
   - Separate from main backend

3. **Convex Dashboard** - (if deployed)
   - Web UI for managing the backend
   - View tables, run functions, monitor logs

### Hosting

- **Platform**: Railway
- **Backend URL**: `https://api.polybuys.com`
- **Actions URL**: `https://actions.polybuys.com`
- **Database**: SQLite (default) or PostgreSQL/MySQL (configurable)
- **Object Storage**: Container filesystem (default) or S3-compatible storage

## Developer Setup

### 1. Get Credentials

Ask tech leads for:

- Backend URL (usually `https://api.polybuys.com`)
- Admin key (generated via `./generate_admin_key.sh`)

### 2. Configure Environment Variables

**Backend** (`backend/.env.local`):

```bash
CONVEX_SELF_HOSTED_URL='https://api.polybuys.com'
CONVEX_SELF_HOSTED_ACTIONS_URL='https://actions.polybuys.com'
CONVEX_SELF_HOSTED_ADMIN_KEY='<admin-key>'
```

**Frontend** (`frontend/.env.local`):

```bash
EXPO_PUBLIC_CONVEX_URL='https://api.polybuys.com'
```

### 3. Run Development Server

```bash
# Terminal 1: Start backend sync
npm run dev:backend

# Terminal 2: Start Expo app
npm run dev
```

The backend sync (`npx convex dev`) will:

- Connect to the self-hosted backend
- Push your schema and functions
- Generate TypeScript types in `backend/convex/_generated/`
- Watch for changes

## CLI Commands

All standard Convex CLI commands work with self-hosted:

```bash
cd backend

# Run a query function with arguments
npx convex run listings:getListings '{"paginationOpts":{"numItems":20,"cursor":null}}'

# Run with filters
npx convex run listings:getListings '{"category":"textbooks","paginationOpts":{"numItems":20,"cursor":null}}'

# Search and filter listings
npx convex run listings:searchAndFilterListings '{"filters":{"category":"textbooks"},"paginationOpts":{"numItems":20,"cursor":null}}'

# Create data (requires authentication - use Convex dashboard or authenticated client instead)
# Example payload structure:
# {"title":"Test Book","description":"Great condition","price":25,"category":"textbooks","condition":"used","images":["https://example.com/image.jpg"]}

# Import data
npx convex import --table listings data.jsonl

# View data
npx convex data

# View logs (if available)
npx convex logs
```

## Differences from Cloud Convex

### What's Different

1. **Environment Variables**:
   - Cloud: `CONVEX_DEPLOYMENT`, `CONVEX_URL`
   - Self-hosted: `CONVEX_SELF_HOSTED_URL`, `CONVEX_SELF_HOSTED_ADMIN_KEY`

2. **No Cloud Dashboard** (unless deployed separately)
   - Use CLI commands instead
   - Or deploy the dashboard container

3. **No Automatic Scaling**
   - Need to configure Railway resources
   - Monitor performance manually

4. **Manual Backups**
   - Set up backup strategy for Railway
   - Use `npx convex export` for data exports

### What's the Same

- ✅ All Convex functions (queries, mutations, actions)
- ✅ Real-time subscriptions
- ✅ TypeScript code generation
- ✅ Schema validation
- ✅ Search indexes
- ✅ File storage
- ✅ Convex React hooks (`useQuery`, `useMutation`, etc.)

## Deployment

### Backend Deployment (Railway)

The Convex backend runs in a Docker container on Railway:

1. **Docker Image**: Official Convex self-hosted image
2. **Persistent Storage**: Railway volumes for SQLite data
3. **Environment Variables**: Set in Railway dashboard
4. **Domains**:
   - `api.polybuys.com` → port 3210
   - `actions.polybuys.com` → port 3211

### S3 Storage on Railway

By default, the Convex backend stores file data on the container filesystem. To
use durable object storage (recommended for production), configure S3 buckets
and set these environment variables on the **Convex Railway service**:

```bash
AWS_REGION=your-region
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
S3_STORAGE_EXPORTS_BUCKET=convex-snapshot-exports
S3_STORAGE_SNAPSHOT_IMPORTS_BUCKET=convex-snapshot-imports
S3_STORAGE_MODULES_BUCKET=convex-modules
S3_STORAGE_FILES_BUCKET=convex-user-files
S3_STORAGE_SEARCH_BUCKET=convex-search-indexes
```

Optional (required for R2 or other S3-compatible providers):

```bash
S3_ENDPOINT_URL=https://<your-s3-compatible-endpoint>
```

After setting variables in Railway, redeploy the Convex backend service.

### Frontend Deployment

When deploying the Expo app (Netlify, Vercel, EAS, etc.):

- Set `EXPO_PUBLIC_CONVEX_URL=https://api.polybuys.com` in your deployment environment
- No need for the admin key in frontend deployments

## Maintenance

### Generating New Admin Keys

SSH into Railway or run locally:

```bash
docker compose exec backend ./generate_admin_key.sh
```

Save the key securely and share with team members via secure channel.

### Upgrading Convex Version

1. Update in `package.json`:

   ```bash
   npm install convex@latest
   ```

2. Update Railway Docker image to match version

3. Test locally before deploying

### Backups

**Automated** (recommended):

- Configure Railway automatic backups
- Set up scheduled exports via cron job

**Manual**:

```bash
# Export all data
npx convex export --path backup.zip

# Export specific table
npx convex export --table listings --path listings-backup.jsonl
```

### Migrating Storage Providers

If you switch between filesystem storage and S3 storage (or vice versa), move
data with a full snapshot export/import:

```bash
# Export from current backend
npx convex export --path backup.zip
```

Then point your CLI at a fresh backend using the new storage provider and run:

```bash
# Import into new backend (replaces all existing data)
npx convex import --replace-all backup.zip
```

Run this during a maintenance window, since imports replace existing data.

### Monitoring

- **Railway Logs**: Check Railway dashboard for backend logs
- **CLI Logs**: `npx convex logs` (if enabled)
- **Health Check**: `curl https://api.polybuys.com`

## Troubleshooting

### "Connection failed" errors

1. Check Railway deployment status
2. Verify backend URL is accessible: `curl https://api.polybuys.com`
3. Confirm admin key is correct in `.env.local`

### Generated types not updating

```bash
cd backend
npx convex dev --once  # Force regenerate
```

### Functions not deploying

```bash
# Check for TypeScript errors
npm run typecheck

# Push with verbose logging
npx convex dev --verbose
```

## Resources

- [Convex Self-Hosted Docs](https://github.com/get-convex/convex-backend)
- [Railway Docs](https://docs.railway.app/)
- [Convex Discord #self-hosted](https://discord.gg/convex)

## Tech Lead Notes

### Initial Setup (Already Complete)

1. ✅ Deploy Convex backend to Railway
2. ✅ Configure domains (api.polybuys.com, actions.polybuys.com)
3. ✅ Generate admin keys
4. ✅ Update all documentation
5. ✅ Update `.env.example` files

### Future Considerations

- **PostgreSQL/MySQL**: Can migrate from SQLite if needed
- **S3 Storage**: Use the "S3 Storage on Railway" section above
- **Dashboard Deployment**: Optional, for team access
- **Multiple Environments**: Can set up staging/production backends
