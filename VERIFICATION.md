# FORME verification

Updated 4 November 2026.

- Repository secret/generated-file audit, TypeScript lint and production builds pass. Builds were checked with Google authentication enabled and disabled.
- All 22 unit tests pass, including cryptographic Neon signature/issuer/audience/expiry checks, verified-email enforcement, Vercel API/SPA routing boundaries, image storage constraints, photo counts, stock/coupon rules and password hashing.
- All 113 live API checks pass against MongoDB Atlas through the existing port-3000 server. These cover sessions/CSRF, role and ownership guards, uploads, reviews, voting, prices/coupons, atomic inventory, idempotency, fulfilment, revenue and account erasure. Disposable records are removed afterward.
- `test:media` verifies new uploads store binary WebP in MongoDB without local image files; existing published images match served bytes and owner/post references. It also checks private drafts, invalid batches, ownership, transaction rollback, deletion and repeat migration.
- `test:neon` verifies repeated identities reuse one MongoDB user, new users remain customers, existing local emails require explicit authenticated linking, and IDs/passwords/roles are preserved. Test accounts are removed afterward.
- Browser checks at 390, 768 and 1440 pixels pass for storefront overflow, size selection and add-to-bag. Admin/customer navigation and role protection pass. Reduced-motion reveals pass.
- Browser checks cover 1-, 2- and 3-photo publishing with simulated post persistence, aligned form fields, maximum/empty upload states and photo-label preservation on removal. No real user posts were created by these UI checks.
- The real Neon SDK browser callback flow passes with simulated provider responses. The configured real Neon signing-key endpoint returns EdDSA keys, and real Continue with Google reaches accounts.google.com without a provider/API error. Personal Google login/consent was not performed; complete that acceptance check on the deployed domain.
- Twelve concurrent serverless-style initializations reused one MongoDB connection with a bounded pool. Runtime rate limits and upload cleanup use MongoDB/TTL, without background application workers.
- No high/critical production dependency advisories remain. Seven low-severity transitive advisories remain in unused SDK UI/email dependencies; see the deployment guide.
- The app has not been deployed to Vercel. Previously tracked secrets must be rotated before publishing; index removal does not erase Git history. PayU remains unimplemented; checkout is COD.

Run `npm run check`, then `npm run test:atlas`, `npm run test:media` and `npm run test:neon` with the existing server on port 3000. See [deployment instructions](docs/DEPLOYMENT.md).
