# Fix for Dynamic Import Error in Production

## Problem
You're seeing this error in production:
```
TypeError: Failed to fetch dynamically imported module: https://railwayapp-strapi-qzlh-production.up.railway.app/admin/EditConfigurationPage-dMHIBbF1-CdlpqXPy.js
```

## Root Cause
The Strapi admin panel is trying to load JavaScript modules with incorrect URLs. This happens when the `URL` and `ADMIN_URL` environment variables are not properly configured in production.

## Solution

### Step 1: Set Environment Variables in Railway.app

Add these environment variables to your Railway.app deployment:

```
URL=https://railwayapp-strapi-qzlh-production.up.railway.app
ADMIN_URL=https://railwayapp-strapi-qzlh-production.up.railway.app/admin
```

**Important:** Replace `https://railwayapp-strapi-qzlh-production.up.railway.app` with your actual Railway production URL.

### Step 2: Rebuild and Redeploy

After setting the environment variables:

1. Trigger a new deployment in Railway.app
2. Or manually rebuild:
   ```bash
   pnpm build
   pnpm start
   ```

### Step 3: Verify

Access your admin panel at:
```
https://railwayapp-strapi-qzlh-production.up.railway.app/admin
```

The dynamic import errors should now be resolved.

## What Changed

### `config/admin.ts`
Added the `url` configuration to properly set the admin panel base URL:
```typescript
export default ({ env }) => ({
  // ... other config
  url: env('ADMIN_URL', '/admin'),
});
```

### `.env.example`
Added environment variable examples:
```
URL=https://your-domain.com
ADMIN_URL=https://your-domain.com/admin
```

## Additional Notes

- The `URL` variable is used by [`config/server.ts`](config/server.ts:7) for the main server URL
- The `ADMIN_URL` variable is used by [`config/admin.ts`](config/admin.ts:17) for the admin panel
- Both variables must use your production domain with HTTPS
- After setting these variables, Strapi will correctly generate asset URLs

## Troubleshooting

If the issue persists:

1. **Clear browser cache** - Old cached files might be causing issues
2. **Check Railway logs** - Look for any build or runtime errors
3. **Verify build output** - Ensure the build directory contains the admin panel files
4. **Check proxy settings** - The [`config/server.ts`](config/server.ts:8) has `proxy: true` which is correct for Railway

## Development vs Production

- **Development:** These URLs default to `/admin` (relative paths work fine)
- **Production:** Absolute URLs are required for proper asset loading