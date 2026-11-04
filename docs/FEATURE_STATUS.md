# FORME feature and security status

Updated 4 November 2026.

| Requirement | Implementation |
| --- | --- |
| Size recommender | Product-page form and validated server endpoint; explained general chart estimate, no saved body measurements |
| Outfit recommendations | Bag suggests up to three complementary, in-stock pieces; sizes and existing cart stock rules apply |
| Outfit face-off | Public community feed, 2–3 photos, labels/caption, public consent, seven-day vote window, one changeable vote/member, owner deletion |
| Product reviews | 1–5 rating, text, up to three photos, own edit/delete, paging, aggregate score and server-verified delivered-purchase badge |
| Compressed uploads | Browser resize plus authoritative Sharp decode/re-encode; metadata removed; 1200px/250KB WebP; file storage outside MongoDB |
| User dashboard | Order/review/post/vote totals, profile, order management, password settings, active session controls |
| Admin dashboard | Existing earnings, orders, customers, coupons and inventory; community moderation added at `/admin/community` |
| Password hashing | Salted scrypt hashes; current password required for sensitive actions |
| Authentication and authorization | JWT HttpOnly SameSite cookies, live database role/session checks, owner checks and admin-only APIs |
| Session limit | Three active sessions; oldest revoked on fourth login; eight-hour expiry; list/revoke individual sessions; profile edits rotate the current slot |
| Request limits | Overall 300/minute/IP; auth 30/15 minutes; bounded upload, vote, post and review rates; five new posts/account/day |
| Query injection protection | express-validator, recursively rejected `$`/dot/prototype keys, typed allowlists; request objects never used as raw database filters |
| Account GET/PUT/PATCH/DELETE | Owner-scoped; PUT name/age; PATCH partial/password; password-confirmed deletion |
| Account data removal | Remove user, sessions, posts, votes, reviews and photo records/files; cancel pending orders/restock; remove identity/email/address from retained financial snapshots |
| In-transit orders | Closure blocked until shipped order is delivered/resolved; the user sees why |
| Google authentication | Deferred by request. No Neon or OAuth integration is claimed |

The retired photo-fitting feature's routes, UI, runtime assets, Python service, dependencies, environment settings and feature-specific output archive were removed. Old links resolve to the normal missing-page state. A database cleanup removes its unused product field.

Operational notes: persist `uploads/community/` with backups in deployment. Rate limits are per Node process; multiple instances require a shared store. Public image URLs use no-store and are disabled by database deletion before physical unlink; orphan cleanup retries periodically. Current-user bag/wishlist are cleared on account deletion; copies users downloaded or made public elsewhere cannot be remotely erased. JWT sessions predating this session-registry update require a fresh login.
