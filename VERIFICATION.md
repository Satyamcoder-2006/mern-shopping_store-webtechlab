# FORME verification

Updated 4 November 2026.

- TypeScript and production build passed after the community and security changes.
- 13 unit tests passed: domain validation/totals, salted password hashing, measurement-based sizing and stock honesty, complementary outfit selection, metadata-free bounded WebP compression, Mongo operator/prototype rejection, and occupied-port fallback.
- 113 live API checks passed against the configured MongoDB Atlas cluster.
- The expanded live API suite checks existing commerce behavior plus profile PUT/PATCH, compressed uploads, private drafts/public attached images, photo ownership, public post consent, face-off vote uniqueness/replacement, review rating and ownership, delivered-purchase badges, admin moderation authorization, member dashboard, three-session cap, individual session revocation, and account-data erasure/anonymization.
- Account deletion tests verify posts, votes, reviews and media records disappear and customer identity/email/address are removed from retained orders. Pending reservations are cancelled/restocked; in-transit closure is rejected.
- Only uniquely named disposable users/products/coupons/orders/posts/reviews/photos are created by verification and removed afterward, including anonymized test-order snapshots.
- Native browser visual inspection confirmed the updated public community landing page and its empty state. Further browser interaction was stopped by the computer-use tool because it could not reliably verify the current URL; remaining checks were performed through the build and API suite. A complete interactive browser/mobile acceptance pass is still advisable.
- Google authentication is intentionally deferred. No model or photo-fitting service remains in the running app.

Reproduce checks with npm test, npm run lint, npm run build, and node scripts/verify-commerce.mjs (build first). See docs/FEATURE_STATUS.md and docs/SIZING.md for feature behavior, limitations and research.
