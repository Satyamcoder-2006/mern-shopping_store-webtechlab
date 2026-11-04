# Deploy FORME to Vercel

One Vercel project serves the Vite frontend and the Express API through `api/[...path].ts`. MongoDB Atlas holds all store data and uploaded image bytes. Neon Auth is optional and handles Google identity. Checkout remains cash on delivery; PayU is not enabled.

## Before publishing

Git previously tracked `.env`, `.admin-credentials.txt`, dependencies and build output. These have been removed from the index and are ignored; local files are preserved. This does not erase earlier Git history. Rotate the MongoDB database password, JWT secret and any administrator password exposed through those files before deployment. Update your local environment and Vercel variables with the new values.

Review the staged removals before committing. `git ls-files -- .env .admin-credentials.txt node_modules dist uploads` should return nothing. Never commit credentials.

## Local commands

Use Node.js 22, from the repository root:

```sh
npm ci
npm run env:check
npm run check
npm run db:setup
npm run dev
```

For a fresh checkout, copy `.env.example` to `.env` and fill in real values before `env:check`. The shared local site runs only at `http://localhost:3000`. Stop the old instance before starting another; no automatic port fallback is used.

`db:setup` applies repeatable, additive catalogue migrations, production indexes and legacy image migration. Existing product IDs and stock are preserved. Run it against the intended database before the first deployment. Vercel API cold starts do not seed or migrate data.

To provision an administrator, set `ADMIN_EMAIL` locally and run `npm run admin:setup` once. An existing account keeps its password; a new account gets a private local credentials file. Never run administrator setup during a Vercel build.

For a standalone production server, stop dev, then run `npm run build` and `npm start`. Vercel does not use `npm start`.

## MongoDB Atlas

Use an application database user with the required read/write and index-creation permissions. Configure Atlas Network Access for your deployment's egress addresses; a localhost-only allowlist will not work. Prefer restricted/static egress where available. An entry of `0.0.0.0/0` permits every source address and must be chosen deliberately with strong credentials.

Keep the existing database name to retain current users and products. Use a separate database and Neon branch for isolated preview deployments. Back up MongoDB, including the `media` collection, before deployment changes.

## Vercel settings

Import the repository into one Vercel project. Select the repository root containing `package.json` and `vercel.json`.

| Setting | Value |
| --- | --- |
| Framework preset | Vite |
| Node.js version | 22.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Development command, if requested | `npm run dev` |
| Start command | None; Vercel invokes the API function |

The supplied `vercel.json` sets the build options, a 30-second API duration and SPA routing excluding `/api`. Do not replace this with a rewrite that sends API requests to `index.html`.

Add these in Vercel Project Settings → Environment Variables, selecting the correct Production/Preview environments:

| Variable | Required | Value |
| --- | --- | --- |
| `MONGO_URI` | Yes | Atlas connection string using the rotated database password |
| `MONGO_DB_NAME` | Recommended | `shopDB` or your intended application database |
| `JWT_SECRET` | Yes | Fresh cryptographically random secret, at least 32 characters |
| `COOKIE_SECURE` | Recommended | `true`; production cookies are always Secure |
| `NEON_AUTH_URL` | For Google | Managed Better Auth URL including its database/auth path |
| `VITE_NEON_AUTH_URL` | For Google | Exactly the same public Auth URL, embedded in the browser build |

`PORT=3000` is local only. `ADMIN_EMAIL` is for one-time admin setup. Vercel supplies its own `VERCEL` and production runtime settings. Never prefix database credentials, JWT secrets or Google client secrets with `VITE_`. Google client secrets belong in Neon's provider configuration.

Generate a JWT secret with your password manager or Node's cryptographic random generator, and store it in environment settings rather than source files.

After setting variables and committing/pushing the intended changes, deploy from the Vercel dashboard. Changing `VITE_NEON_AUTH_URL` requires a rebuild. No separate frontend/backend host or cron worker is needed.

## Neon Auth and Google

1. Select a Neon project/branch and enable Managed Better Auth. Use its Auth URL, not a legacy Stack Auth key or Postgres connection string. Identity records live in Neon; application/customer records remain in MongoDB.
2. Enable Google in the Neon Auth dashboard. For custom Google OAuth credentials, copy the exact redirect URI supplied by Neon into Google Cloud. Google's direct callback goes to Neon, not FORME.
3. Add your exact application origins to Neon's trusted/allowed redirects: `http://localhost:3000`, your HTTPS Vercel/custom domain, and any explicitly allowed preview domains. FORME's callback is `<application-origin>/auth/callback`.
4. Set both Neon URL variables, run `npm run env:check`, restart local development and redeploy Vercel after changing build variables.
5. Continue with Google. After Neon authenticates the user, the browser gets a fresh Neon JWT. The API verifies its signature, issuer, audience, expiry and verified email, creates/reuses the MongoDB user and issues the existing FORME HttpOnly session.
6. For an existing local email account, log in with its password first, then use Account security → Connect Google. The email must match. This preserves the MongoDB ID, orders, reviews, password and role; later Google logins reuse that account.

New Google users are customers and do not receive an invented age or password. Google-only users manage login through Google and can add their own profile details. Administrator roles come only from MongoDB, never a Neon role claim.

The Google button stays hidden while the public Auth URL is empty. Signed-token verification and MongoDB linking are tested; a real Google consent round trip still requires your Neon/Google setup and must be checked on the deployed domain. Test supported browsers because cross-site cookie restrictions can affect provider sessions.

## Verification

After deployment, check `/api/health` returns HTTP 200 with `status: "ok"`. Refresh `/shop`, a product URL, `/community`, `/account` and `/admin` directly. API routes should return JSON rather than SPA HTML.

Test password and Google login, logout, linking, customer/admin access, sizes, coupons and a disposable COD order. Confirm stock and order totals in admin. Verify anonymous reviews and sizing, 1–3-photo posts, and image availability after redeployment. Unpublished upload URLs must return 404.

Local commands use the existing port-3000 website and do not start a second server:

```sh
npm run check
npm run test:atlas
npm run test:media
npm run test:neon
npm audit --omit=dev --audit-level=high
```

Live suites create uniquely identified disposable records and remove them afterward; prefer a staging database. Unit/build/secret checks need no external auth credentials. Identity tests are not a real Google consent test.

## Operation and remaining scope

- Each warm API process reuses its MongoDB connection, capped at five connections. Rate-limit counters are stored in MongoDB and expire automatically across Vercel instances.
- MongoDB TTL removes only unattached uploads after roughly an hour and expired rate-limit counters. Expiration is asynchronous and needs no cron worker. Published images do not match the draft filter.
- Images are compressed before upload; the API's 4 MB JSON limit stays below Vercel's 4.5 MB function payload cap. Stored images are at most 250 KB each. Runtime uploads never write local image files.
- Dependency audit has no high/critical advisories after patched Better Auth/Zod overrides. Seven low-severity transitive advisories remain in Neon's unused UI/email dependency chain (`deepmerge`). The app does not import those modules. Track upstream fixes; do not run `npm audit fix --force` blindly.
- PayU remains a separate step: it needs server-side payment initiation, authenticated callback/webhook verification, idempotency and reconciliation before changing COD behavior.

References: [Vite/API functions on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Vercel payload limits](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions), [Neon JWT verification](https://neon.com/docs/auth/guides/plugins/jwt), [Neon SDK](https://github.com/neondatabase/neon-js/tree/main/packages/auth), [Atlas Network Access](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
